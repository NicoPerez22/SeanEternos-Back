export class CreateTournamentDto {
  name: string;
  logo?: string;
  teamsIds: number[];
  formatId?: number;
  statistics?: any;
}
