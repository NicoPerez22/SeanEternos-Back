export class CreateTransferOfferDto {
  fromTeamId: number;
  targetPlayerId: number;
  offeredPlayerId: number;
  note?: string;
}

export class ReviewTransferOfferDto {
  action: 'approve' | 'reject';
  reviewNote?: string;
}