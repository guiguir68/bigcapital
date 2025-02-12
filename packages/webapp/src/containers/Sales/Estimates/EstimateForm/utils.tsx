// @ts-nocheck
import React, { useMemo } from 'react';
import * as R from 'ramda';
import intl from 'react-intl-universal';
import moment from 'moment';
import { useFormikContext } from 'formik';
import { omit, first } from 'lodash';
import {
  defaultFastFieldShouldUpdate,
  repeatValue,
  transformToForm,
  formattedAmount,
  toSafeNumber,
} from '@/utils';
import { useEstimateFormContext } from './EstimateFormProvider';
import {
  updateItemsEntriesTotal,
  ensureEntriesHaveEmptyLine,
} from '@/containers/Entries/utils';
import { useCurrentOrganization } from '@/hooks/state';
import { getEntriesTotal } from '@/containers/Entries/utils';
import {
  transformAttachmentsToForm,
  transformAttachmentsToRequest,
} from '@/containers/Attachments/utils';
import { convertBrandingTemplatesToOptions } from '@/containers/BrandingTemplates/BrandingTemplatesSelectFields';

export const MIN_LINES_NUMBER = 1;

export const defaultEstimateEntry = {
  index: 0,
  item_id: '',
  rate: '',
  discount: '',
  quantity: '',
  description: '',
  amount: '',
};

const defaultEstimateEntryReq = {
  index: 0,
  item_id: '',
  rate: '',
  discount: '',
  quantity: '',
  description: '',
};

export const defaultEstimate = {
  customer_id: '',
  estimate_date: moment(new Date()).format('YYYY-MM-DD'),
  expiration_date: moment(new Date()).format('YYYY-MM-DD'),
  estimate_number: '',
  // Holds the estimate number that entered manually only.
  estimate_number_manually: '',
  delivered: '',
  reference: '',
  note: '',
  terms_conditions: '',
  branch_id: '',
  warehouse_id: '',
  exchange_rate: 1,
  currency_code: '',
  entries: [...repeatValue(defaultEstimateEntry, MIN_LINES_NUMBER)],
  attachments: [],
  pdf_template_id: '',
  adjustment: '',
  discount: '',
  discount_type: 'amount',
};

const ERRORS = {
  ESTIMATE_NUMBER_IS_NOT_UNQIUE: 'ESTIMATE.NUMBER.IS.NOT.UNQIUE',
  SALE_ESTIMATE_NO_IS_REQUIRED: 'SALE_ESTIMATE_NO_IS_REQUIRED',
};

export const transformToEditForm = (estimate) => {
  const initialEntries = [
    ...estimate.entries.map((estimate) => ({
      ...transformToForm(estimate, defaultEstimateEntry),
    })),
    ...repeatValue(
      defaultEstimateEntry,
      Math.max(MIN_LINES_NUMBER - estimate.entries.length, 0),
    ),
  ];
  const entries = R.compose(
    ensureEntriesHaveEmptyLine(defaultEstimateEntry),
    updateItemsEntriesTotal,
  )(initialEntries);

  const attachments = transformAttachmentsToForm(estimate);

  return {
    ...transformToForm(estimate, defaultEstimate),
    entries,
    attachments,
  };
};

/**
 * Detarmines customers fast field when update.
 */
export const customersFieldShouldUpdate = (newProps, oldProps) => {
  return (
    newProps.shouldUpdateDeps.items !== oldProps.shouldUpdateDeps.items ||
    defaultFastFieldShouldUpdate(newProps, oldProps)
  );
};

/**
 * Detarmines entries fast field should update.
 */
export const entriesFieldShouldUpdate = (newProps, oldProps) => {
  return (
    newProps.items !== oldProps.items ||
    defaultFastFieldShouldUpdate(newProps, oldProps)
  );
};

export const ITEMS_FILTER_ROLES = JSON.stringify([
  {
    index: 1,
    fieldKey: 'sellable',
    value: true,
    condition: '&&',
    comparator: 'equals',
  },
  {
    index: 2,
    fieldKey: 'active',
    value: true,
    condition: '&&',
    comparator: 'equals',
  },
]);

/**
 * Transform response errors to fields.
 * @param {*} errors
 * @param {*} param1
 */
export const handleErrors = (errors, { setErrors }) => {
  if (errors.some((e) => e.type === ERRORS.ESTIMATE_NUMBER_IS_NOT_UNQIUE)) {
    setErrors({
      estimate_number: intl.get('estimate_number_is_not_unqiue'),
    });
  }
  if (
    errors.some((error) => error.type === ERRORS.SALE_ESTIMATE_NO_IS_REQUIRED)
  ) {
    setErrors({
      estimate_number: intl.get(
        'estimate.field.error.estimate_number_required',
      ),
    });
  }
};

/**
 * Transform the form values to request body.
 */
export const transfromsFormValuesToRequest = (values) => {
  const entries = values.entries.filter(
    (item) => item.item_id && item.quantity,
  );
  const attachments = transformAttachmentsToRequest(values);

  return {
    ...omit(values, ['estimate_number_manually', 'estimate_number']),
    // The `estimate_number_manually` will be presented just if the auto-increment
    // is disable, always both attributes hold the same value in manual mode.
    ...(values.estimate_number_manually && {
      estimate_number: values.estimate_number,
    }),
    entries: entries.map((entry) => ({
      ...transformToForm(entry, defaultEstimateEntryReq),
    })),
    attachments,
  };
};

export const useSetPrimaryWarehouseToForm = () => {
  const { setFieldValue } = useFormikContext();
  const { warehouses, isWarehousesSuccess } = useEstimateFormContext();

  React.useEffect(() => {
    if (isWarehousesSuccess) {
      const primaryWarehouse =
        warehouses.find((b) => b.primary) || first(warehouses);

      if (primaryWarehouse) {
        setFieldValue('warehouse_id', primaryWarehouse.id);
      }
    }
  }, [isWarehousesSuccess, setFieldValue, warehouses]);
};

export const useSetPrimaryBranchToForm = () => {
  const { setFieldValue } = useFormikContext();
  const { branches, isBranchesSuccess } = useEstimateFormContext();

  React.useEffect(() => {
    if (isBranchesSuccess) {
      const primaryBranch = branches.find((b) => b.primary) || first(branches);

      if (primaryBranch) {
        setFieldValue('branch_id', primaryBranch.id);
      }
    }
  }, [isBranchesSuccess, setFieldValue, branches]);
};

/**
 * Retrieves the estimate subtotal.
 * @returns {number}
 */
export const useEstimateSubtotal = () => {
  const {
    values: { entries },
  } = useFormikContext();

  // Retrieves the invoice entries total.
  const subtotal = useMemo(() => getEntriesTotal(entries), [entries]);

  return subtotal;
};

/**
 * Retrieves the estimate subtotal formatted.
 * @returns {string}
 */
export const useEstimateSubtotalFormatted = () => {
  const subtotal = useEstimateSubtotal();
  const {
    values: { currency_code: currencyCode },
  } = useFormikContext();

  return formattedAmount(subtotal, currencyCode);
};

/**
 * Retrieves the estimate discount amount.
 * @returns {number}
 */
export const useEstimateDiscount = () => {
  const { values } = useFormikContext();
  const subtotal = useEstimateSubtotal();
  const discount = toSafeNumber(values.discount);

  return values?.discount_type === 'percentage'
    ? (subtotal * discount) / 100
    : discount;
};

/**
 * Retrieves the estimate discount formatted.
 * @returns {string}
 */
export const useEstimateDiscountFormatted = () => {
  const discount = useEstimateDiscount();
  const {
    values: { currency_code: currencyCode },
  } = useFormikContext();

  return formattedAmount(discount, currencyCode);
};

/**
 * Retrieves the estimate adjustment amount.
 * @returns {number}
 */
export const useEstimateAdjustment = () => {
  const { values } = useFormikContext();
  const adjustmentAmount = toSafeNumber(values.adjustment);

  return adjustmentAmount;
};

/**
 * Retrieves the estimate adjustment formatted.
 * @returns {string}
 */
export const useEstimateAdjustmentFormatted = () => {
  const adjustment = useEstimateAdjustment();
  const {
    values: { currency_code: currencyCode },
  } = useFormikContext();

  return formattedAmount(adjustment, currencyCode);
};

/**
 * Retrieves the estimate total.
 * @returns {number}
 */
export const useEstimateTotal = () => {
  const subtotal = useEstimateSubtotal();
  const discount = useEstimateDiscount();
  const adjustment = useEstimateAdjustment();

  return R.compose(
    R.subtract(R.__, discount),
    R.add(R.__, adjustment),
  )(subtotal);
};

/**
 * Retrieves the estimate total formatted.
 * @returns {string}
 */
export const useEstimateTotalFormatted = () => {
  const total = useEstimateTotal();
  const {
    values: { currency_code: currencyCode },
  } = useFormikContext();

  return formattedAmount(total, currencyCode);
};

/**
 * Detarmines whether the estimate has foreign customer.
 * @returns {boolean}
 */
export const useEstimateIsForeignCustomer = () => {
  const { values } = useFormikContext();
  const currentOrganization = useCurrentOrganization();

  const isForeignCustomer = React.useMemo(
    () => values.currency_code !== currentOrganization.base_currency,
    [values.currency_code, currentOrganization.base_currency],
  );
  return isForeignCustomer;
};

/**
 * Resets the form values.
 */
export const resetFormState = ({ initialValues, values, resetForm }) => {
  resetForm({
    values: {
      // Reset the all values except the warehouse and brand id.
      ...initialValues,
      warehouse_id: values.warehouse_id,
      brand_id: values.brand_id,
    },
  });
};

export const useEstimateFormBrandingTemplatesOptions = () => {
  const { brandingTemplates } = useEstimateFormContext();

  return React.useMemo(
    () => convertBrandingTemplatesToOptions(brandingTemplates),
    [brandingTemplates],
  );
};
