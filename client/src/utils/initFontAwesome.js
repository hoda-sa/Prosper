import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faLink,
  faUser,
  faPowerOff,
  // Navigation icons
  faHome,
  faExchangeAlt,
  faChartPie,
  faChartLine,
  faChartBar,
  faCog,
  // Transaction icons
  faArrowUp,
  faArrowDown,
  faPlusCircle,
  faMinusCircle,
  faPlus,
  faMinus,
  faEdit,
  faTrash,
  faTimes,
  faCheck,
  // Status icons
  faExclamationTriangle,
  faInfoCircle,
  faInbox,
  faCheckCircle,
  // Financial icons
  faDollarSign,
  faCreditCard,
  faWallet,
  faUniversity,
  faReceipt,
  faFileInvoiceDollar,
  faBalanceScale,
  faPiggyBank,
  // Utility icons
  faCalendarAlt,
  faFilter,
  faDownload,
  faUpload,
  faSync,
  faBell,
  faEye,
  faEyeSlash,
  // Additional useful icons
  faSearch,
  faSpinner,
  faSave,
  faCircle,
  faSquare,
  // Plaid-specific icons
  faUnlink,
  faShieldAlt,
  // Additional icons to prevent missing icon errors
  faLightbulb,
  faBullhorn,
  faFlag,
  faHeart,
  faStar,
  faThumbsUp,
  faThumbsDown,
  faQuestion,
  faQuestionCircle,
  faTimesCircle,
  faPlayCircle,
  faPauseCircle,
  faStopCircle
} from "@fortawesome/free-solid-svg-icons";

function initFontAwesome() {
  library.add(
    // Existing icons
    faLink,
    faUser,
    faPowerOff,
    // Navigation icons
    faHome,
    faExchangeAlt,
    faChartPie,
    faChartLine,
    faChartBar,
    faCog,
    // Transaction icons
    faArrowUp,
    faArrowDown,
    faPlusCircle,
    faMinusCircle,
    faPlus,
    faMinus,
    faEdit,
    faTrash,
    faTimes,
    faCheck,
    // Status icons
    faExclamationTriangle,
    faInfoCircle,
    faInbox,
    faCheckCircle,
    // Financial icons
    faDollarSign,
    faCreditCard,
    faWallet,
    faUniversity,
    faReceipt,
    faFileInvoiceDollar,
    faBalanceScale,
    faPiggyBank,
    // Utility icons
    faCalendarAlt,
    faFilter,
    faDownload,
    faUpload,
    faSync,
    faBell,
    faEye,
    faEyeSlash,
    // Additional icons
    faSearch,
    faSpinner,
    faSave,
    faCircle,
    faSquare,
    // Plaid icons
    faUnlink,
    faShieldAlt,
    // Additional icons to prevent missing icon errors
    faLightbulb,
    faBullhorn,
    faFlag,
    faHeart,
    faStar,
    faThumbsUp,
    faThumbsDown,
    faQuestion,
    faQuestionCircle,
    faTimesCircle,
    faPlayCircle,
    faPauseCircle,
    faStopCircle
  );
}

export default initFontAwesome;