export class UserDTO {
  id: number;
  name: string;
  email: string;
  password: string;
}

export class ResponseUserDTO {
  id: number;
  name: string;
  email: string;
  lastName: string;

  constructor(obj?){
    this.id = obj && obj.id || null;
    this.name = obj && obj.name || null;
    this.email = obj && obj.email || null;
    this.lastName = obj && obj.lastName || null;
  }
}
