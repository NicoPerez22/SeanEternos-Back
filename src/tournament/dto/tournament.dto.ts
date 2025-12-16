export class CreateTournamentDto {
  name: string;
  logo: string;
  formatId?: number;
  teamsIds: number[];
  rounds: Array<{
    round: number;
    home: number;
    away: number;
    state?: number | null;
    teamWin?: number | null;
    teamLose?: number | null;
  }>;
}