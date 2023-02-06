import moment from 'moment';
import { sumBy } from 'lodash';
import { Knex } from 'knex';
import { Inject, Service } from 'typedi';
import * as R from 'ramda';
import { AccountNormal, IBill, IItemEntry, ILedgerEntry } from '@/interfaces';
import HasTenancyService from '@/services/Tenancy/TenancyService';
import Ledger from '@/services/Accounting/Ledger';
import LedgerStorageService from '@/services/Accounting/LedgerStorageService';

@Service()
export class BillGLEntries {
  @Inject()
  private tenancy: HasTenancyService;

  @Inject()
  private ledgerStorage: LedgerStorageService;

  /**
   * Creates bill GL entries.
   * @param {number} tenantId -
   * @param {number} billId -
   * @param {Knex.Transaction} trx -
   */
  public writeBillGLEntries = async (
    tenantId: number,
    billId: number,
    trx?: Knex.Transaction
  ) => {
    const { accountRepository } = this.tenancy.repositories(tenantId);
    const { Bill } = this.tenancy.models(tenantId);

    // Retrieves bill with associated entries and landed costs.
    const bill = await Bill.query(trx)
      .findById(billId)
      .withGraphFetched('entries.item')
      .withGraphFetched('entries.allocatedCostEntries')
      .withGraphFetched('locatedLandedCosts.allocateEntries');

    // Finds or create a A/P account based on the given currency.
    const APAccount = await accountRepository.findOrCreateAccountsPayable(
      bill.currencyCode,
      {},
      trx
    );
    const billLedger = this.getBillLedger(bill, APAccount.id);

    // Commit the GL enties on the storage.
    await this.ledgerStorage.commit(tenantId, billLedger, trx);
  };

  /**
   * Reverts the given bill GL entries.
   * @param {number} tenantId
   * @param {number} billId
   * @param {Knex.Transaction} trx
   */
  public revertBillGLEntries = async (
    tenantId: number,
    billId: number,
    trx?: Knex.Transaction
  ) => {
    await this.ledgerStorage.deleteByReference(tenantId, billId, 'Bill', trx);
  };

  /**
   * Rewrites the given bill GL entries.
   * @param {number} tenantId
   * @param {number} billId
   * @param {Knex.Transaction} trx
   */
  public rewriteBillGLEntries = async (
    tenantId: number,
    billId: number,
    trx?: Knex.Transaction
  ) => {
    // Reverts the bill GL entries.
    await this.revertBillGLEntries(tenantId, billId, trx);

    // Writes the bill GL entries.
    await this.writeBillGLEntries(tenantId, billId, trx);
  };

  /**
   * Retrieves the bill common entry.
   * @param   {IBill} bill
   * @returns {ILedgerEntry}
   */
  private getBillCommonEntry = (bill: IBill) => {
    return {
      debit: 0,
      credit: 0,
      currencyCode: bill.currencyCode,
      exchangeRate: bill.exchangeRate || 1,

      transactionId: bill.id,
      transactionType: 'Bill',

      date: moment(bill.billDate).format('YYYY-MM-DD'),
      userId: bill.userId,

      referenceNumber: bill.referenceNo,
      transactionNumber: bill.billNumber,

      branchId: bill.branchId,
      projectId: bill.projectId,

      createdAt: bill.createdAt,
    };
  };

  /**
   * Retrieves the bill item inventory/cost entry.
   * @param {IBill} bill -
   * @param {IItemEntry} entry -
   * @param {number} index -
   */
  private getBillItemEntry = R.curry(
    (bill: IBill, entry: IItemEntry, index: number): ILedgerEntry => {
      const commonJournalMeta = this.getBillCommonEntry(bill);

      const localAmount = bill.exchangeRate * entry.amount;
      const landedCostAmount = sumBy(entry.allocatedCostEntries, 'cost');

      return {
        ...commonJournalMeta,
        debit: localAmount + landedCostAmount,
        accountId:
          ['inventory'].indexOf(entry.item.type) !== -1
            ? entry.item.inventoryAccountId
            : entry.costAccountId,
        index: index + 1,
        indexGroup: 10,
        itemId: entry.itemId,
        itemQuantity: entry.quantity,
        accountNormal: AccountNormal.DEBIT,
      };
    }
  );

  /**
   * Retrieves the bill landed cost entry.
   * @param {IBill} bill -
   * @param {} landedCost -
   * @param {number} index -
   */
  private getBillLandedCostEntry = R.curry(
    (bill: IBill, landedCost, index: number): ILedgerEntry => {
      const commonJournalMeta = this.getBillCommonEntry(bill);

      return {
        ...commonJournalMeta,
        credit: landedCost.amount,
        accountId: landedCost.costAccountId,
        accountNormal: AccountNormal.DEBIT,
        index: 1,
        indexGroup: 20,
      };
    }
  );

  /**
   * Retrieves the bill payable entry.
   * @param   {number} payableAccountId
   * @param   {IBill} bill
   * @returns {ILedgerEntry}
   */
  private getBillPayableEntry = (
    payableAccountId: number,
    bill: IBill
  ): ILedgerEntry => {
    const commonJournalMeta = this.getBillCommonEntry(bill);

    return {
      ...commonJournalMeta,
      credit: bill.localAmount,
      accountId: payableAccountId,
      contactId: bill.vendorId,
      accountNormal: AccountNormal.CREDIT,
      index: 1,
      indexGroup: 5,
    };
  };

  /**
   * Retrieves the given bill GL entries.
   * @param   {IBill} bill
   * @param   {number} payableAccountId
   * @returns {ILedgerEntry[]}
   */
  private getBillGLEntries = (
    bill: IBill,
    payableAccountId: number
  ): ILedgerEntry[] => {
    const payableEntry = this.getBillPayableEntry(payableAccountId, bill);

    const itemEntryTransformer = this.getBillItemEntry(bill);
    const landedCostTransformer = this.getBillLandedCostEntry(bill);

    const itemsEntries = bill.entries.map(itemEntryTransformer);
    const landedCostEntries = bill.locatedLandedCosts.map(
      landedCostTransformer
    );
    // Allocate cost entries journal entries.
    return [payableEntry, ...itemsEntries, ...landedCostEntries];
  };

  /**
   * Retrieves the given bill ledger.
   * @param   {IBill} bill
   * @param   {number} payableAccountId
   * @returns {Ledger}
   */
  private getBillLedger = (bill: IBill, payableAccountId: number) => {
    const entries = this.getBillGLEntries(bill, payableAccountId);

    return new Ledger(entries);
  };
}
