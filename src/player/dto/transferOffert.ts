export class CreateTransferOfferDto {
  fromTeamId: number;
  targetPlayerIds: number[];
  offeredPlayerIds: number[];
  note?: string;
}

export class ReviewTransferOfferDto {
  action: 'approve' | 'reject';
  reviewNote?: string;
}