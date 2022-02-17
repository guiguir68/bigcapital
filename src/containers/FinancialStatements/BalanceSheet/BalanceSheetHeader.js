import React from 'react';
import { Tabs, Tab, Button, Intent } from '@blueprintjs/core';
import moment from 'moment';
import { Formik, Form } from 'formik';
import styled from 'styled-components';

import { FormattedMessage as T } from 'components';

import withBalanceSheet from './withBalanceSheet';
import withBalanceSheetActions from './withBalanceSheetActions';

import BalanceSheetHeaderGeneralPanal from './BalanceSheetHeaderGeneralPanal';
import BalanceSheetHeaderComparisonPanal from './BalanceSheetHeaderComparisonPanal';
import FinancialStatementHeader from '../../FinancialStatements/FinancialStatementHeader';

import { compose, transformToForm } from 'utils';
import {
  getBalanceSheetHeaderValidationSchema,
  getDefaultBalanceSheetQuery,
} from './utils';

/**
 * Balance sheet header.
 */
function BalanceSheetHeader({
  // #ownProps
  onSubmitFilter,
  pageFilter,

  // #withBalanceSheet
  balanceSheetDrawerFilter,

  // #withBalanceSheetActions
  toggleBalanceSheetFilterDrawer: toggleFilterDrawer,
}) {
  const defaultValues = getDefaultBalanceSheetQuery();

  // Filter form initial values.
  const initialValues = transformToForm(
    {
      ...defaultValues,
      ...pageFilter,
      fromDate: moment(pageFilter.fromDate).toDate(),
      toDate: moment(pageFilter.toDate).toDate(),
    },
    defaultValues,
  );
  // Validation schema.
  const validationSchema = getBalanceSheetHeaderValidationSchema();

  // Handle form submit.
  const handleSubmit = (values, actions) => {
    onSubmitFilter(values);
    toggleFilterDrawer(false);
    actions.setSubmitting(false);
  };

  // Handle cancel button click.
  const handleCancelClick = () => {
    toggleFilterDrawer(false);
  };

  // Handle drawer close action.
  const handleDrawerClose = () => {
    toggleFilterDrawer(false);
  };

  return (
    <BalanceSheetFinancialHeader
      isOpen={balanceSheetDrawerFilter}
      drawerProps={{
        onClose: handleDrawerClose,
      }}
    >
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        <Form>
          <Tabs animate={true} vertical={true} renderActiveTabPanelOnly={true}>
            <Tab
              id="general"
              title={<T id={'general'} />}
              panel={<BalanceSheetHeaderGeneralPanal />}
            />
            <Tab
              id="comparison"
              title={<T id={'balance_sheet.comparisons'} />}
              panel={<BalanceSheetHeaderComparisonPanal />}
            />
          </Tabs>

          <div class="financial-header-drawer__footer">
            <Button className={'mr1'} intent={Intent.PRIMARY} type={'submit'}>
              <T id={'calculate_report'} />
            </Button>
            <Button onClick={handleCancelClick} minimal={true}>
              <T id={'cancel'} />
            </Button>
          </div>
        </Form>
      </Formik>
    </BalanceSheetFinancialHeader>
  );
}

export default compose(
  withBalanceSheet(({ balanceSheetDrawerFilter }) => ({
    balanceSheetDrawerFilter,
  })),
  withBalanceSheetActions,
)(BalanceSheetHeader);

const BalanceSheetFinancialHeader = styled(FinancialStatementHeader)`
  .bp3-drawer {
    max-height: 520px;
  }
`;
