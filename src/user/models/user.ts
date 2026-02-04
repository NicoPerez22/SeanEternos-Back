export class UserDTO {
  email: string;
  password: string;
  name: string;
  lastName: string;
  userName: string;
}

export class ResponseUserDTO {
  id: number;
  name: string;
  email: string;
  lastName: string;
  userName: string;

  constructor(obj?){
    this.id = obj && obj.id || null;
    this.name = obj && obj.name || null;
    this.email = obj && obj.email || null;
    this.lastName = obj && obj.lastName || null;
    this.userName = obj && obj.userName || null;
  }
}
