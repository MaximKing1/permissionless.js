import fs from 'fs';
import path from 'path';
import axios from 'axios';

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

class PermissionlessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionlessError';
  }
}

class Permissionless {
  private config!: PermissionlessConfig;
  private configFilePath: string;
  private cache: Map<string, string[]> = new Map();
  private memoWildcardMatch = new Map<string, RegExp>();

  constructor(configFilePath: string = '.permissionless.json') {
    this.configFilePath = path.resolve(process.cwd(), configFilePath);
    this.loadConfig();

    // Watch for changes to the config file
    fs.watch(this.configFilePath, (eventType) => {
      if (eventType === 'change') {
        console.log(
          '[Permissionless] Configuration file changed. Reloading...'
        );
        this.loadConfig();
        this.clearCache();
      }
    });
  }

  private loadConfig(): void {
    if (!fs.existsSync(this.configFilePath)) {
      throw new PermissionlessError(
        `Configuration file not found at ${this.configFilePath}`
      );
    }
    try {
      const configFileContent = fs.readFileSync(this.configFilePath, 'utf-8');
      this.config = JSON.parse(configFileContent) as PermissionlessConfig;
    } catch (error) {
      throw new PermissionlessError(
        `Failed to parse configuration file: ${error}`
      );
    }
    this.validateConfig(this.config);
  }

  private validateConfig(config: PermissionlessConfig): void {
    if (!config.roles || typeof config.roles !== 'object') {
      throw new PermissionlessError('Configuration must include roles object');
    }

    // Validate each role
    Object.entries(config.roles).forEach(([roleName, role]) => {
      if (!Array.isArray(role.permissions)) {
        throw new PermissionlessError(
          `Role ${roleName} must have permissions array`
        );
      }
      if (role.inherits && !Array.isArray(role.inherits)) {
        throw new PermissionlessError(
          `Role ${roleName} inherits must be an array`
        );
      }
    });
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
      let regex = this.memoWildcardMatch.get(permission);
      if (!regex) {
        regex = new RegExp(`^${permission.replace(/\*/g, '.*')}$`);
        this.memoWildcardMatch.set(permission, regex);
      }
      return regex.test(requested);
    }
    return permission === requested;
  }

  /**
   * Checks if a user has the specified permission, optionally within a context.
   * 
   * @param user - The user object containing id and role
   * @param permission - The permission to check (e.g. 'read', 'write')
   * @param context - Optional context to scope the permission (e.g. 'articles', 'comments')
   * @returns True if the user has the permission, false otherwise
   * 
   * @example
   * ```ts
   * const user = { id: '123', role: 'editor' };
   * permissions.hasPermission(user, 'write', 'articles'); // true/false
   * ```
   */
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

  /**
   * Retrieves all permissions for a specified role, including inherited ones.
   * 
   * @param role - The role name to get permissions for
   * @returns Array of permission strings for the role
   * 
   * @example
   * ```ts
   * const editorPerms = permissions.getPermissionsForRole('editor');
   * // Returns: ['read:articles', 'write:articles']
   * ```
   */
  public getPermissionsForRole(role: string): string[] {
    return this.getRolePermissions(role);
  }

  /**
   * Adds a new role with specified permissions and optional inheritance.
   * 
   * @param roleName - The name of the new role
   * @param permissions - Array of permission strings to grant to the role
   * @param inherits - Optional array of role names this role should inherit from
   * @throws Error if role already exists
   * 
   * @example
   * ```ts
   * permissions.addRole('moderator', ['moderate:comments'], ['viewer']);
   * ```
   */
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

  /**
   * Adds a new permission to an existing role.
   * 
   * @param roleName - The name of the role to modify
   * @param permission - The permission string to add
   * @throws Error if role does not exist
   * 
   * @example
   * ```ts
   * permissions.addPermissionToRole('viewer', 'read:docs');
   * ```
   */
  public addPermissionToRole(roleName: string, permission: string): void {
    const role = this.config.roles[roleName];
    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }
    role.permissions.push(permission);
    this.clearCache();
  }

  /**
   * Clears the internal permissions cache.
   * Call this after making changes to roles or permissions.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Loads permission configuration from an external API endpoint.
   * 
   * @param apiUrl - The URL to fetch the configuration from
   * @throws Error if the API request fails or returns invalid config
   * 
   * @example
   * ```ts
   * await permissions.loadConfigFromApi('https://example.com/permissions.json');
   * ```
   */
  public async loadConfigFromApi(apiUrl: string): Promise<void> {
    const response = await axios.get(apiUrl);
    if (response.status !== 200) {
      throw new Error(`Failed to load configuration from ${apiUrl}`);
    }
    this.config = response.data as PermissionlessConfig;
    this.clearCache();
    this.validateConfig(this.config);
  }

  /**
   * Returns a list of all defined role names.
   * 
   * @returns Array of role name strings
   * 
   * @example
   * ```ts
   * const roles = permissions.listRoles();
   * // Returns: ['admin', 'editor', 'viewer']
   * ```
   */
  public listRoles(): string[] {
    return Object.keys(this.config.roles);
  }

  /**
   * Returns a list of all user IDs with specific permissions/denies.
   * 
   * @returns Array of user ID strings
   * 
   * @example
   * ```ts
   * const users = permissions.listUsers();
   * // Returns: ['123', '456']
   * ```
   */
  public listUsers(): string[] {
    return Object.keys(this.config.users || {});
  }

  /**
   * Checks if a role exists in the configuration.
   * 
   * @param roleName - The role name to check
   * @returns True if the role exists, false otherwise
   * 
   * @example
   * ```ts
   * if (permissions.hasRole('admin')) {
   *   console.log('Admin role exists');
   * }
   * ```
   */
  public hasRole(roleName: string): boolean {
    return !!this.config.roles[roleName];
  }

  /**
   * Checks if a user has ALL of the specified permissions.
   * 
   * @param user - The user object containing id and role
   * @param permissions - Array of permission strings to check
   * @param context - Optional context to scope the permissions
   * @returns True if user has ALL permissions, false otherwise
   * 
   * @example
   * ```ts
   * const hasAll = permissions.checkMultiplePermissions(
   *   user,
   *   ['read', 'write'],
   *   'articles'
   * );
   * ```
   */
  public checkMultiplePermissions(
    user: User,
    permissions: string[],
    context?: string
  ): boolean {
    return permissions.every((permission) =>
      this.hasPermission(user, permission, context)
    );
  }

  /**
   * Checks if a user has ANY of the specified permissions.
   * 
   * @param user - The user object containing id and role
   * @param permissions - Array of permission strings to check
   * @param context - Optional context to scope the permissions
   * @returns True if user has ANY permission, false otherwise
   * 
   * @example
   * ```ts
   * const hasAny = permissions.checkAnyPermission(
   *   user,
   *   ['read', 'write'],
   *   'articles'
   * );
   * ```
   */
  public checkAnyPermission(
    user: User,
    permissions: string[],
    context?: string
  ): boolean {
    return permissions.some((permission) =>
      this.hasPermission(user, permission, context)
    );
  }
}

export { Permissionless };
export default Permissionless;
