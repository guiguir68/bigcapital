// @ts-nocheck

import { connect } from 'react-redux';

export const withBanking = (mapState) => {
  const mapStateToProps = (state, props) => {
    const mapped = {
      openMatchingTransactionAside: state.plaid.openMatchingTransactionAside,
      selectedUncategorizedTransactionId:
        state.plaid.uncategorizedTransactionIdForMatching,
    };
    return mapState ? mapState(mapped, state, props) : mapped;
  };
  return connect(mapStateToProps);
};
