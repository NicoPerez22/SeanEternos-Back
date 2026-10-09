import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';

describe('Player management', () => {
  let repository: any;
  let service: PlayerService;
  beforeEach(() => {
    repository = { create: jest.fn(value => value), save: jest.fn(async value => ({ id: 1, ...value })), delete: jest.fn() };
    service = new PlayerService(repository, {} as any, {} as any, {} as any);
  });

  it('creates a player with the selected team and default transfer status', async () => {
    const result = await service.createPlayer({ name: 'Juan', lastName: 'Pérez', teamId: 4, valoration: 80, position: 'MC', photo: '', isHabilitado: true });
    expect(result.httpCode).toBe(200);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ idTeam: 4, team: { id: 4 }, isTransfer: false }));
  });

  it('returns the deleted id when a record was removed', async () => {
    repository.delete.mockResolvedValue({ affected: 1 });
    await expect(service.deletePlayer(5)).resolves.toEqual(expect.objectContaining({ data: { id: 5 }, httpCode: 200 }));
    expect(repository.delete).toHaveBeenCalledWith(5);
  });

  it('returns not found rather than success for a missing player', async () => {
    repository.delete.mockResolvedValue({ affected: 0 });
    await expect(service.deletePlayer(5)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports a conflict if related data prevents deletion', async () => {
    repository.delete.mockRejectedValue(new Error('Foreign key constraint'));
    await expect(service.deletePlayer(5)).rejects.toBeInstanceOf(ConflictException);
  });

  it('checks the role from the database for existing email-only tokens', async () => {
    const users = { findOneByEmail: jest.fn().mockResolvedValue({ idRol: '1' }) };
    const players = { deletePlayer: jest.fn().mockResolvedValue({ data: { id: 5 } }) };
    const controller = new PlayerController(players as any, users as any);
    await controller.deletePlayer(5, { user: { email: 'admin@example.test' } });
    expect(users.findOneByEmail).toHaveBeenCalledWith('admin@example.test');
    expect(players.deletePlayer).toHaveBeenCalledWith(5);
  });

  it('prevents non-administrators from creating, editing or deleting players', async () => {
    const users = { findOneByEmail: jest.fn().mockResolvedValue({ idRol: '2' }) };
    const players = { createPlayer: jest.fn(), updatePlayer: jest.fn(), deletePlayer: jest.fn() };
    const controller = new PlayerController(players as any, users as any);
    const request = { user: { email: 'user@example.test', idRol: 1 } };
    await expect(controller.createTeam({}, request)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.updatePlayer(5, {}, request)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.deletePlayer(5, request)).rejects.toBeInstanceOf(ForbiddenException);
    expect(players.createPlayer).not.toHaveBeenCalled();
    expect(players.updatePlayer).not.toHaveBeenCalled();
    expect(players.deletePlayer).not.toHaveBeenCalled();
  });
});