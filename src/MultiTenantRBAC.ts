// Type Definitions for Configuration and Adapters
export interface MultiTenantRBACConfig {
  userIdField?: string;
  tenantIdField?: string;
  roleField?: string;
}

export interface DatabaseAdapter {
  createTenant(name: string): Promise<any>;
  createRole(
    tenantId: string,
    roleName: string,
    permissions: string[]
  ): Promise<any>;
  assignRoleToUser(user: Record<string, any>, roleName: string): Promise<void>;
  getRoleForUser(user: Record<string, any>): Promise<any>;
  addPermissionToRole(
    tenantId: string,
    roleName: string,
    permission: string
  ): Promise<void>;
  revokePermissionFromRole(
    tenantId: string,
    roleName: string,
    permission: string
  ): Promise<void>;
}

// Core Multi-Tenant RBAC Class
export class MultiTenantRBAC {
  private config: Required<MultiTenantRBACConfig>;
  private adapter: DatabaseAdapter;

  constructor(adapter: DatabaseAdapter, config: MultiTenantRBACConfig = {}) {
    // Default field names
    this.config = {
      userIdField: config.userIdField || 'id',
      tenantIdField: config.tenantIdField || 'tenantId',
      roleField: config.roleField || 'role',
    };

    this.adapter = adapter;
  }

  public async createTenant(name: string): Promise<any> {
    return this.adapter.createTenant(name);
  }

  public async createRole(
    tenantId: string,
    roleName: string,
    permissions: string[]
  ): Promise<any> {
    return this.adapter.createRole(tenantId, roleName, permissions);
  }

  public async assignRoleToUser(
    user: Record<string, any>,
    roleName: string
  ): Promise<void> {
    return this.adapter.assignRoleToUser(user, roleName);
  }

  public async hasPermission(
    user: Record<string, any>,
    permission: string
  ): Promise<boolean> {
    const role = await this.adapter.getRoleForUser(user);

    if (!role)
      throw new Error(`Role "${user[this.config.roleField]}" not found`);

    return role.permissions.includes(permission);
  }

  public async addPermissionToRole(
    tenantId: string,
    roleName: string,
    permission: string
  ): Promise<void> {
    return this.adapter.addPermissionToRole(tenantId, roleName, permission);
  }

  public async revokePermissionFromRole(
    tenantId: string,
    roleName: string,
    permission: string
  ): Promise<void> {
    return this.adapter.revokePermissionFromRole(
      tenantId,
      roleName,
      permission
    );
  }
}
