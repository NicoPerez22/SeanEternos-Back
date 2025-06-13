export class MatchesInterface {
    id: any
    away: any;
    home: any;
    score: any;
    victory: any;
    lose: any;
    draw: any;
    idRound: any;
    idTournament: any;
    tournament: any
    rounds: any

    constructor(obj?: any){
        this.id = obj && obj.id || 0;
        this.away = obj && obj.away || null;
        this.home = obj && obj.home || null;
        this.score = obj && obj.score || null;
        this.victory = obj && obj.victory || null;
        this.lose = obj && obj.lose || null;
        this.draw = obj && obj.draw || null;
        this.idRound = obj && obj.idRound || null;
        this.idTournament = obj && obj.idTournament || null;
        this.tournament = obj && obj.tournament || null;
        this.rounds = obj && obj.rounds || null
    }
}