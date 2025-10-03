import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import './main.css';

const StyledDangerButtonRoot = styled(Button)(({ theme }) => ({
  color: theme.palette.common.white,
  backgroundColor: theme.palette.error.main,
  borderRadius: '8px',
  '&:hover': {
    backgroundColor: theme.palette.error.dark,
  },
}));

const StyledDangerButton = (props : any) => {
  return <StyledDangerButtonRoot {...props} className="danger-button" />;
};

export default StyledDangerButton;