import { ChangePasswordDTO } from './change-password';

export class ResetPasswordDTO extends ChangePasswordDTO {
  token: string;
}
