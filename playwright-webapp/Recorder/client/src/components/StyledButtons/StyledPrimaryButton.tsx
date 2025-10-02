import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import '../../css/main.css';

const StyledPrimaryButtonRoot = styled(Button)(({ theme }) => ({
  color: theme.palette.common.white,
  backgroundColor: theme.palette.primary.main,
  borderRadius: '8px',
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));

const StyledPrimaryButton = (props : any) => {
  return <StyledPrimaryButtonRoot {...props} className="primary-button" />;
};

export default StyledPrimaryButton;