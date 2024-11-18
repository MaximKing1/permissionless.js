import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

interface PermissionlessConfig {
  roles: Record<
    string,
    {
      permissions: string[];
      inherits?: string[];
    }
  >;
  users?: Record<
    string,
    {
      permissions?: string[];
      denies?: string[];
    }
  >;
}

interface User {
  id: string;
  role: string;
  [key: string]: any;
}

class Permissionless {
  private config!: PermissionlessConfig;
  private configFilePath: string;
  private cache: Map<string, string[]> = new Map();

  constructor(configFilePath: string = '.permissionless.json') {
    this.configFilePath = path.resolve(process.cwd(), configFilePath);
    this.loadConfig();

    // Watch for changes to the config file
    fs.watch(this.configFilePath, (eventType) => {
      if (eventType === 'change') {
        console.log('Configuration file changed. Reloading...');
        this.loadConfig();
        this.clearCache();
      }
    });
  }

  private loadConfig(): void {
    if (!fs.existsSync(this.configFilePath)) {
      throw new Error(`Configuration file not found at ${this.configFilePath}`);
    }
    const configFileContent = fs.readFileSync(this.configFilePath, 'utf-8');
    this.config = JSON.parse(configFileContent) as PermissionlessConfig;
  }

  private getRolePermissions(
    roleName: string,
    visited: Set<string> = new Set()
  ): string[] {
    if (this.cache.has(roleName)) {
      return this.cache.get(roleName)!;
    }

    const role = this.config.roles[roleName];
    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    if (visited.has(roleName)) {
      throw new Error(`Circular inheritance detected in role: ${roleName}`);
    }

    visited.add(roleName);

    const permissions = new Set(role.permissions);
    if (role.inherits) {
      for (const inheritedRole of role.inherits) {
        const inheritedPermissions = this.getRolePermissions(
          inheritedRole,
          visited
        );
        inheritedPermissions.forEach((perm) => permissions.add(perm));
      }
    }

    const result = Array.from(permissions);
    this.cache.set(roleName, result);
    return result;
  }

  private matchesWildcard(permission: string, requested: string): boolean {
    if (permission.includes('*')) {
      const regex = new RegExp(`^${permission.replace(/\*/g, '.*')}$`);
      return regex.test(requested);
    }
    return permission === requested;
  }

  public hasPermission(
    user: User,
    permission: string,
    context?: string
  ): boolean {
    const userOverrides = this.config.users?.[user.id] || {};
    const fullPermission = context ? `${permission}:${context}` : permission;

    // Check denies first
    if (
      userOverrides.denies?.some((denied) =>
        this.matchesWildcard(denied, fullPermission)
      )
    ) {
      return false;
    }

    // Check specific user permissions
    if (
      userOverrides.permissions?.some((granted) =>
        this.matchesWildcard(granted, fullPermission)
      )
    ) {
      return true;
    }

    // Check role-based permissions
    const rolePermissions = this.getRolePermissions(user.role);
    return rolePermissions.some((perm) =>
      this.matchesWildcard(perm, fullPermission)
    );
  }

  public getPermissionsForRole(role: string): string[] {
    return this.getRolePermissions(role);
  }

  public addRole(
    roleName: string,
    permissions: string[],
    inherits?: string[]
  ): void {
    if (this.config.roles[roleName]) {
      throw new Error(`Role ${roleName} already exists`);
    }
    this.config.roles[roleName] = { permissions, inherits };
    this.clearCache();
  }

  public addPermissionToRole(roleName: string, permission: string): void {
    const role = this.config.roles[roleName];
    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }
    role.permissions.push(permission);
    this.clearCache();
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public async loadConfigFromApi(apiUrl: string): Promise<void> {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to load configuration from ${apiUrl}`);
    }
    this.config = (await response.json()) as PermissionlessConfig;
    this.clearCache();
  }
}

export default Permissionless;
