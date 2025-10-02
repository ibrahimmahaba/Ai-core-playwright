import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';

const StyledPrimaryButtonRoot = styled(Button)(({ theme }) => ({
  color: theme.palette.common.white,
  backgroundColor: theme.palette.primary.main,
  borderRadius: '8px',
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));

const StyledPrimaryButton = (props : any) => {
  return <StyledPrimaryButtonRoot {...props} />;
};

export default StyledPrimaryButton;