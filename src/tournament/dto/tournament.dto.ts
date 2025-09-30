export class CreateTournamentDto {
  name: string;
  logo?: string;
  teamsIds: number[];
  formatId?: number;
  statistics?: any;
}

export class TournamentDTO {
  name: string;
  logo: string;
  isActive: boolean;
  startDate: string;

  constructor(partial?: Partial<TournamentDTO>) {
    Object.assign(this, partial);
  }
}
