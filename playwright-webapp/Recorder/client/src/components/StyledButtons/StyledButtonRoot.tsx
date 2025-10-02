import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import '../../css/main.css';

const StyledButtonRoot = styled(Button)(({ theme }) => ({
  color: theme.palette.text.primary,
  border: 'none',
}));

const StyledButton = (props : any) => {
  return <StyledButtonRoot {...props} className="default-button" />;
};

export default StyledButton;