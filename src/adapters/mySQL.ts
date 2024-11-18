import mysql from "mysql2/promise";
import { DatabaseAdapter } from "../MultiTenantRBAC";

export class MySQLAdapter implements DatabaseAdapter {
  private connection: mysql.Connection;

  constructor(connection: mysql.Connection) {
    this.connection = connection;
  }

  async createTenant(name: string): Promise<any> {
    const [result] = await this.connection.query(
      "INSERT INTO tenants (name) VALUES (?)",
      [name]
    );
    return result;
  }

  async createRole(
    tenantId: string,
    roleName: string,
    permissions: string[]
  ): Promise<any> {
    const [result] = await this.connection.query(
      "INSERT INTO roles (tenantId, name, permissions) VALUES (?, ?, ?)",
      [tenantId, roleName, JSON.stringify(permissions)]
    );
    return result;
  }

  async assignRoleToUser(
    user: Record<string, any>,
    roleName: string
  ): Promise<void> {
    const [role] = await this.connection.query(
      "SELECT id FROM roles WHERE tenantId = ? AND name = ?",
      [user.tenantId, roleName]
    );

    if (!role) throw new Error(`Role "${roleName}" not found for tenant ${user.tenantId}`);

    await this.connection.query(
      "INSERT INTO tenantUsers (userId, tenantId, roleId) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE roleId = ?",
      [user.id, user.tenantId, role.id, role.id]
    );
  }

  async getRoleForUser(user: Record<string, any>): Promise<any> {
    const [result] = await this.connection.query(
      `
      SELECT r.permissions FROM roles r
      JOIN tenantUsers tu ON r.id = tu.roleId
      WHERE tu.userId = ? AND tu.tenantId = ?`,
      [user.id, user.tenantId]
    );

    return result.length ? JSON.parse(result[0].permissions) : null;
  }

  async addPermissionToRole(
    tenantId: string,
    roleName: string,
    permission: string
  ): Promise<void> {
    const [role] = await this.connection.query(
      "SELECT id, permissions FROM roles WHERE tenantId = ? AND name = ?",
      [tenantId, roleName]
    );

    if (!role) throw new Error(`Role "${roleName}" not found for tenant ${tenantId}`);

    const updatedPermissions = JSON.parse(role.permissions).concat(permission);

    await this.connection.query(
      "UPDATE roles SET permissions = ? WHERE id = ?",
      [JSON.stringify(updatedPermissions), role.id]
    );
  }

  async revokePermissionFromRole(
    tenantId: string,
    roleName: string,
    permission: string
  ): Promise<void> {
    const [role] = await this.connection.query(
      "SELECT id, permissions FROM roles WHERE tenantId = ? AND name = ?",
      [tenantId, roleName]
    );

    if (!role) throw new Error(`Role "${roleName}" not found for tenant ${tenantId}`);

    const updatedPermissions = JSON.parse(role[0].permissions).filter(
      (perm: string) => perm !== permission
    );

    await this.connection.query(
      "UPDATE roles SET permissions = ? WHERE id = ?",
      [JSON.stringify(updatedPermissions), role.id]
    );
  }
}
