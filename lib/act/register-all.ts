// Import every ACT registration module so they self-register via side-effects.
// Import this once (e.g. at the top of BurnActView / RepairActView) before
// creating any ActionRunner.

// Action steps
import './action-steps/MTRA_TRANSFER';
import './action-steps/CXPO_BUY';
import './action-steps/OPEN_SFC';

// Actions
import './actions/mtra/mtra';
import './actions/cx-buy/cx-buy';

// Material groups
import './material-groups/resupply/resupply';
import './material-groups/repair/repair';
