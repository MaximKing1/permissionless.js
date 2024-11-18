import { Db } from "mongodb";
import { DatabaseAdapter } from "../MultiTenantRBAC";

export class MongoDBAdapter implements DatabaseAdapter {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async createTenant(name: string): Promise<any> {
    const result = await this.db.collection("tenants").insertOne({ name });
    return result.insertedId;
  }

  async createRole(
    tenantId: string,
    roleName: string,
    permissions: string[]
  ): Promise<any> {
    const result = await this.db.collection("roles").insertOne({
      tenantId,
      name: roleName,
      permissions,
    });
    return result.insertedId;
  }

  async assignRoleToUser(
    user: Record<string, any>,
    roleName: string
  ): Promise<void> {
    const role = await this.db.collection("roles").findOne({
      tenantId: user.tenantId,
      name: roleName,
    });

    if (!role) throw new Error(`Role "${roleName}" not found for tenant ${user.tenantId}`);

    await this.db.collection("tenantUsers").updateOne(
      { userId: user.id, tenantId: user.tenantId },
      { $set: { roleId: role._id } },
      { upsert: true }
    );
  }

  async getRoleForUser(user: Record<string, any>): Promise<any> {
    const tenantUser = await this.db.collection("tenantUsers").findOne({
      userId: user.id,
      tenantId: user.tenantId,
    });

    if (!tenantUser) return null;

    const role = await this.db.collection("roles").findOne({ _id: tenantUser.roleId });
    return role || null;
  }

  async addPermissionToRole(
    tenantId: string,
    roleName: string,
    permission: string
  ): Promise<void> {
    await this.db.collection("roles").updateOne(
      { tenantId, name: roleName },
      { $addToSet: { permissions: permission } }
    );
  }

  async revokePermissionFromRole(
    tenantId: string,
    roleName: string,
    permission: string
  ): Promise<void> {
    await this.db.collection("roles").updateOne(
      { tenantId, name: roleName },
      { $pull: { permissions: permission } }
    );
  }
}
