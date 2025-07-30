import { ApiClient } from '../ApiClient';
import { User, CreateUserRequest, UpdateUserRequest } from '../types';

export class UserService {
  constructor(private client: ApiClient) {}

  /**
   * Note: User CRUD endpoints are not implemented in the actual API
   * These methods throw errors until the server implements them
   */

  async create(_user: CreateUserRequest): Promise<User> {
    throw new Error('User create endpoint not implemented in the server');
  }

  async get(_userId: string): Promise<User> {
    throw new Error('User get endpoint not implemented in the server');
  }

  async update(_userId: string, _updates: UpdateUserRequest): Promise<User> {
    throw new Error('User update endpoint not implemented in the server');
  }

  async delete(_userId: string): Promise<{ success: boolean }> {
    throw new Error('User delete endpoint not implemented in the server');
  }

  async list(_options?: { limit?: number; offset?: number }): Promise<User[]> {
    throw new Error('User list endpoint not implemented in the server');
  }
}