import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Button,
  Classes,
  FormGroup,
  InputGroup,
  Intent,
  TextArea,
  MenuItem,
  Checkbox
} from '@blueprintjs/core';
import { Select } from '@blueprintjs/select';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { useIntl } from 'react-intl';
import { omit } from 'lodash';
import { compose } from 'utils';
import useAsync from 'hooks/async';
import Dialog from 'components/Dialog';
import AppToaster from 'components/AppToaster';
import DialogConnect from 'connectors/Dialog.connector';
import DialogReduxConnect from 'components/DialogReduxConnect';
import AccountFormDialogConnect from 'connectors/AccountFormDialog.connector';
import AccountsConnect from 'connectors/Accounts.connector';
import classNames from 'classnames';
import Icon from 'components/Icon';
import ErrorMessage from 'components/ErrorMessage';

function AccountFormDialog({
  name,
  payload,
  isOpen,
  accountsTypes,
  accounts,
  requestFetchAccounts,
  requestFetchAccountTypes,
  requestFetchAccount,
  closeDialog,
  requestSubmitAccount,
  requestEditAccount,
  getAccountById
}) {
  const intl = useIntl();
  const accountFormValidationSchema = Yup.object().shape({
    name: Yup.string().required(intl.formatMessage({ id: 'required' })),
    code: Yup.number(),
    account_type_id: Yup.string()
      .nullable()
      .required(intl.formatMessage({ id: 'required' })),
    description: Yup.string().trim()
  });

  const initialValues = useMemo(() => ({
    account_type_id: null,
    name: '',
    description: '',
  }), []);

  const [selectedAccountType, setSelectedAccountType] = useState(null);
  const [selectedSubaccount, setSelectedSubaccount] = useState(null);

  const editAccount = useMemo(() =>
    payload.action === 'edit' ? getAccountById(payload.id) : null,
    [payload, getAccountById]);

  // Formik
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...(payload.action === 'edit' && editAccount)
        ? editAccount : initialValues,
    },
    validationSchema: accountFormValidationSchema,
    onSubmit: (values, { setSubmitting }) => {
      const exclude = ['subaccount'];

      if (payload.action === 'edit') {
        requestEditAccount({
          payload: payload.id,
          form: { ...omit(values, exclude) }
        }).then(response => {
          closeDialog(name);
          AppToaster.show({
            message: 'the_account_has_been_edited'
          });
          setSubmitting(false);
        }).catch(() => {
          setSubmitting(false); 
        });
      } else {
        requestSubmitAccount({ form: { ...omit(values, exclude) } }).then(response => {
          closeDialog(name);
          AppToaster.show({
            message: 'the_account_has_been_submit'
          });
          setSubmitting(false);
        }).catch(() => {
          setSubmitting(false);
        });
      }
    }
  });
  const { errors, values, touched } = useMemo(() => (formik), [formik]);

  // Set default account type.
  useEffect(() => {
    if (editAccount && editAccount.account_type_id) {
      const defaultType = accountsTypes.find((t) =>
        t.id === editAccount.account_type_id);

      defaultType && setSelectedAccountType(defaultType);
    }
  }, [editAccount, accountsTypes]);

  // Filters accounts types items.
  const filterAccountTypeItems = (query, accountType, _index, exactMatch) => {
    const normalizedTitle = accountType.name.toLowerCase();
    const normalizedQuery = query.toLowerCase();

    if (exactMatch) {
      return normalizedTitle === normalizedQuery;
    } else {
      return normalizedTitle.indexOf(normalizedQuery) >= 0;
    }
  };

  // Account type item of select filed.
  const accountTypeItem = (item, { handleClick, modifiers, query }) => {
    return <MenuItem text={item.name} key={item.id} onClick={handleClick} />;
  };

  // Account item of select accounts field.
  const accountItem = (item, { handleClick, modifiers, query }) => {
    return (
      <MenuItem text={item.name} label={item.code} key={item.id} onClick={handleClick} />
    );
  };

  // Filters accounts items.
  const filterAccountsPredicater = useCallback((query, account, _index, exactMatch) => {
    const normalizedTitle = account.name.toLowerCase();
    const normalizedQuery = query.toLowerCase();

    if (exactMatch) {
      return normalizedTitle === normalizedQuery;
    } else {
      return `${account.code} ${normalizedTitle}`.indexOf(normalizedQuery) >= 0;
    }
  }, []);

  // Handles dialog close.
  const handleClose = useCallback(() => { closeDialog(name); }, [closeDialog, name]);

  const fetchHook = useAsync(async () => {
    await Promise.all([
      requestFetchAccounts(),
      requestFetchAccountTypes(),
      // Fetch the target in case edit mode.
      ...(payload.action === 'edit' ?
        [requestFetchAccount(payload.id)] : [])
    ]);
  }, false);

  // Fetch requests on dialog opening.
  const onDialogOpening = useCallback(() => { fetchHook.execute(); }, [fetchHook]);

  const onChangeAccountType = useCallback((accountType) => {
    setSelectedAccountType(accountType);
    formik.setFieldValue('account_type_id', accountType.id);
  }, [setSelectedAccountType, formik]);

  // Handles change sub-account.
  const onChangeSubaccount = useCallback((account) => {
    setSelectedSubaccount(account);
    formik.setFieldValue('parent_account_id', account.id);
  }, [setSelectedSubaccount, formik]);

  const onDialogClosed = useCallback(() => {
    formik.resetForm();
    setSelectedSubaccount(null);
    setSelectedAccountType(null);
  }, [formik]);

  const infoIcon = useMemo(() => (<Icon icon="info-circle" iconSize={12} />), []);

  const subAccountLabel = useMemo(() => {
    return (<span>{'Sub account?'} <Icon icon="info-circle" iconSize={12} /></span>);
  }, []);

  const requiredSpan = useMemo(() => (
    <span class="required">*</span>
  ), []);

  return (
    <Dialog
      name={name}
      title={payload.action === 'edit' ? 'Edit Account' : 'New Account'}
      className={{
        'dialog--loading': fetchHook.pending,
        'dialog--account-form': true
      }}
      autoFocus={true}
      canEscapeKeyClose={true}
      onClosed={onDialogClosed}
      onOpening={onDialogOpening}
      isOpen={isOpen}
      isLoading={fetchHook.pending}
      onClose={handleClose}
    >
      <form onSubmit={formik.handleSubmit}>
        <div className={Classes.DIALOG_BODY}>
          <FormGroup
            label={'Account Type'}
            labelInfo={requiredSpan}
            className={classNames(
              'form-group--account-type',
              'form-group--select-list',
              Classes.FILL)}
            inline={true}
            helperText={<ErrorMessage name="account_type_id" {...formik} />}
            intent={(errors.account_type_id && touched.account_type_id) && Intent.DANGER}
          >
            <Select
              items={accountsTypes}
              noResults={<MenuItem disabled={true} text='No results.' />}
              itemRenderer={accountTypeItem}
              itemPredicate={filterAccountTypeItems}
              popoverProps={{ minimal: true }}
              onItemSelect={onChangeAccountType}
            >
              <Button
                rightIcon='caret-down'
                text={selectedAccountType ?
                  selectedAccountType.name : 'Select account type'}
              />
            </Select>
          </FormGroup>

          <FormGroup
            label={'Account Name'}
            labelInfo={requiredSpan}
            className={'form-group--account-name'}
            intent={(errors.name && touched.name) && Intent.DANGER}
            helperText={<ErrorMessage name="name" {...formik} />}
            inline={true}
          >
            <InputGroup
              medium={true}
              intent={(errors.name && touched.name) && Intent.DANGER}
              {...formik.getFieldProps('name')}
            />
          </FormGroup>

          <FormGroup
            label={'Account Code'}
            className={'form-group--account-code'}
            intent={(errors.code && touched.code) && Intent.DANGER}
            helperText={<ErrorMessage name="code" {...formik} />}
            inline={true}
            labelInfo={infoIcon}
          >
            <InputGroup
              medium={true}
              intent={(errors.code && touched.code) && Intent.DANGER}
              {...formik.getFieldProps('code')}
            />
          </FormGroup>

          <FormGroup
            label={' '}
            className={classNames('form-group--subaccount')}
            inline={true}
          >
            <Checkbox
              inline={true}
              label={subAccountLabel}
              {...formik.getFieldProps('subaccount')}
            />
          </FormGroup>

          {values.subaccount && (
            <FormGroup
              label={'Parent Account'}
              className={classNames(
                'form-group--parent-account',
                'form-group--select-list',
                Classes.FILL)}
              inline={true}
            >
              <Select
                items={accounts}
                noResults={<MenuItem disabled={true} text='No results.' />}
                itemRenderer={accountItem}
                itemPredicate={filterAccountsPredicater}
                popoverProps={{ minimal: true }}
                onItemSelect={onChangeSubaccount}
                {...formik.getFieldProps('parent_account_id')}
              >
                <Button
                  rightIcon='caret-down'
                  text={
                    selectedSubaccount ? selectedSubaccount.name : 'Select Parent Account'
                  }
                />
              </Select>
            </FormGroup>
          )}

          <FormGroup
            label={'Description'}
            className={'form-group--description'}
            intent={formik.errors.description && Intent.DANGER}
            helperText={formik.errors.description && formik.errors.credential}
            inline={true}
          >
            <TextArea
              growVertically={true}
              large={true}
              {...formik.getFieldProps('description')}
            />
          </FormGroup>
        </div>

        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={handleClose}>Close</Button>
            <Button intent={Intent.PRIMARY} disabled={formik.isSubmitting} type='submit'>
              {payload.action === 'edit' ? 'Edit' : 'Submit'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export default compose(
  AccountFormDialogConnect,
  AccountsConnect,
  DialogReduxConnect,
  DialogConnect
)(AccountFormDialog);