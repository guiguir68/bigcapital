import React, { useCallback, useEffect } from 'react';
import FinancialStatementHeader from 'containers/FinancialStatements/FinancialStatementHeader';
import { Row, Col, Visible } from 'react-grid-system';
import { FormGroup } from '@blueprintjs/core';
import moment from 'moment';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { FormattedMessage as T, useIntl } from 'react-intl';

import FinancialStatementDateRange from 'containers/FinancialStatements/FinancialStatementDateRange';
import SelectDisplayColumnsBy from '../SelectDisplayColumnsBy';
import RadiosAccountingBasis from '../RadiosAccountingBasis';
import FinancialAccountsFilter from '../FinancialAccountsFilter';

import withBalanceSheet from './withBalanceSheetDetail';
import withBalanceSheetActions from './withBalanceSheetActions';

import { compose } from 'utils';

function BalanceSheetHeader({
  onSubmitFilter,
  pageFilter,
  show,
  refresh,

  // #withBalanceSheetActions
  refreshBalanceSheet,
}) {
  const { formatMessage } = useIntl();

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...pageFilter,
      basis: 'cash',
      from_date: moment(pageFilter.from_date).toDate(),
      to_date: moment(pageFilter.to_date).toDate(),
      none_zero: false,
    },
    validationSchema: Yup.object().shape({
      from_date: Yup.date()
        .required()
        .label(formatMessage({ id: 'from_data' })),
      to_date: Yup.date()
        .min(Yup.ref('from_date'))
        .required()
        .label(formatMessage({ id: 'to_date' })),
      none_zero: Yup.boolean(),
    }),
    onSubmit: (values, actions) => {
      onSubmitFilter(values);
      actions.setSubmitting(false);
    },
  });

  // Handle item select of `display columns by` field.
  const onItemSelectDisplayColumns = useCallback(
    (item) => {
      formik.setFieldValue('display_columns_type', item.type);
      formik.setFieldValue('display_columns_by', item.by);
    },
    [formik],
  );

  const handleAccountingBasisChange = useCallback(
    (value) => {
      formik.setFieldValue('basis', value);
    },
    [formik],
  );

  useEffect(() => {
    if (refresh) {
      formik.submitForm();
      refreshBalanceSheet(false);
    }
  }, [refresh]);

  const handleAccountsFilterSelect = (filterType) => {
    const noneZero = filterType.key === 'without-zero-balance' ? true : false;
    formik.setFieldValue('none_zero', noneZero);
  };

  return (
    <FinancialStatementHeader show={show}>
      <Row>
        <FinancialStatementDateRange formik={formik} />

        <Visible xl>
          <Col width={'100%'} />
        </Visible>

        <Col width={260} offset={10}>
          <SelectDisplayColumnsBy onItemSelect={onItemSelectDisplayColumns} />
        </Col>

        <Col width={260}>
          <FormGroup
            label={<T id={'filter_accounts'} />}
            className="form-group--select-list bp3-fill"
            inline={false}
          >
            <FinancialAccountsFilter
              initialSelectedItem={'all-accounts'}
              onItemSelect={handleAccountsFilterSelect}
            />
          </FormGroup>
        </Col>

        <Col width={260}>
          <RadiosAccountingBasis
            selectedValue={formik.values.basis}
            onChange={handleAccountingBasisChange}
          />
        </Col>
      </Row>
    </FinancialStatementHeader>
  );
}

export default compose(
  withBalanceSheet(({ balanceSheetRefresh }) => ({
    refresh: balanceSheetRefresh,
  })),
  withBalanceSheetActions,
)(BalanceSheetHeader);
