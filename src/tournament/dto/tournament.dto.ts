export class CreateTournamentDto {
  name: string;
  logo: string;
  formatId?: number;
  teamsIds: number[];
  enableDraft: boolean;
}