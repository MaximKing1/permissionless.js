interface User {
    id: string;
    role: string;
    [key: string]: any;
}
declare class Permissionless {
    private config;
    private configFilePath;
    private cache;
    private memoWildcardMatch;
    constructor(configFilePath?: string);
    private loadConfig;
    private validateConfig;
    private getRolePermissions;
    private matchesWildcard;
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
    hasPermission(user: User, permission: string, context?: string): boolean;
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
    getPermissionsForRole(role: string): string[];
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
    addRole(roleName: string, permissions: string[], inherits?: string[]): void;
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
    addPermissionToRole(roleName: string, permission: string): void;
    /**
     * Clears the internal permissions cache.
     * Call this after making changes to roles or permissions.
     */
    clearCache(): void;
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
    loadConfigFromApi(apiUrl: string): Promise<void>;
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
    listRoles(): string[];
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
    listUsers(): string[];
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
    hasRole(roleName: string): boolean;
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
    checkMultiplePermissions(user: User, permissions: string[], context?: string): boolean;
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
    checkAnyPermission(user: User, permissions: string[], context?: string): boolean;
}
export { Permissionless };
export default Permissionless;
