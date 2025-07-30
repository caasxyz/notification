import { User, CreateUserRequest, UpdateUserRequest } from '../types';

export class UserService {

  /**
   * Note: User CRUD endpoints are not implemented in the actual API
   * These methods throw errors until the server implements them
   */

  create(_user: CreateUserRequest): Promise<User> {
    return Promise.reject(new Error('User create endpoint not implemented in the server'));
  }

  get(_userId: string): Promise<User> {
    return Promise.reject(new Error('User get endpoint not implemented in the server'));
  }

  update(_userId: string, _updates: UpdateUserRequest): Promise<User> {
    return Promise.reject(new Error('User update endpoint not implemented in the server'));
  }

  delete(_userId: string): Promise<{ success: boolean }> {
    return Promise.reject(new Error('User delete endpoint not implemented in the server'));
  }

  list(_options?: { limit?: number; offset?: number }): Promise<User[]> {
    return Promise.reject(new Error('User list endpoint not implemented in the server'));
  }
}