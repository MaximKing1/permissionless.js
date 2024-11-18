interface User {
    id: string;
    role: string;
    [key: string]: any;
}
declare class Permissionless {
    private config;
    private configFilePath;
    private cache;
    constructor(configFilePath?: string);
    private loadConfig;
    private getRolePermissions;
    private matchesWildcard;
    hasPermission(user: User, permission: string, context?: string): boolean;
    getPermissionsForRole(role: string): string[];
    addRole(roleName: string, permissions: string[], inherits?: string[]): void;
    addPermissionToRole(roleName: string, permission: string): void;
    clearCache(): void;
    loadConfigFromApi(apiUrl: string): Promise<void>;
    listRoles(): string[];
    listUsers(): string[];
    hasRole(roleName: string): boolean;
    checkMultiplePermissions(user: User, permissions: string[], context?: string): boolean;
    checkAnyPermission(user: User, permissions: string[], context?: string): boolean;
}
export { Permissionless };
export default Permissionless;
