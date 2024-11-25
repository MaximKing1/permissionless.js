"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permissionless = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const axios_1 = __importDefault(require("axios"));
const events_1 = require("events");
class PermissionlessError extends Error {
    constructor(message, code = 'PERMISSIONLESS_ERROR') {
        super(message);
        this.name = 'PermissionlessError';
        this.timestamp = new Date();
        this.code = code;
    }
    toString() {
        return `${this.name} [${this.code}] (${this.timestamp.toISOString()}): ${this.message}`;
    }
}
/**
 * A class for managing role-based permissions and access control.
 *
 * Permissionless provides a flexible system for defining roles, permissions,
 * and user access. It supports:
 * - Role-based permission management
 * - Permission inheritance between roles
 * - User-specific permission overrides
 * - Context-scoped permissions
 * - Wildcard permission patterns
 * - Live config reloading
 *
 * @emits configReloaded - Emitted when the configuration file is reloaded
 * @example
 * ```ts
 * const permissions = new Permissionless({
 *   configFilePath: '.permissionless.json',
 *   auditLogPath: 'permissionless_audit.log'
 * });
 *
 * // Check if a user has permission
 * const canAccess = permissions.hasPermission(user, 'read', 'articles');
 * ```
 */
class Permissionless extends events_1.EventEmitter {
    constructor(configFilePath = '.permissionless.json', auditLogPath = 'permissionless_audit.log') {
        super();
        this.cache = new Map();
        this.memoWildcardMatch = new Map();
        this.permissionCache = new Map();
        this.firestore = null;
        this.configFilePath = node_path_1.default.resolve(process.cwd(), configFilePath);
        this.auditLogPath = node_path_1.default.resolve(process.cwd(), auditLogPath);
        this.loadConfig();
        // Watch for changes to the config file
        node_fs_1.default.watch(this.configFilePath, (eventType) => {
            if (eventType === 'change') {
                console.log('[Permissionless] Configuration file changed. Reloading...');
                this.loadConfig();
                this.clearCache();
                this.emit('configReloaded');
            }
        });
    }
    logAudit(action, details) {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            details,
        };
        node_fs_1.default.appendFileSync(this.auditLogPath, JSON.stringify(entry) + '\n', 'utf-8');
    }
    loadConfig() {
        if (!node_fs_1.default.existsSync(this.configFilePath)) {
            throw new PermissionlessError(`Configuration file not found at ${this.configFilePath}`);
        }
        try {
            const configFileContent = node_fs_1.default.readFileSync(this.configFilePath, 'utf-8');
            this.config = JSON.parse(configFileContent);
        }
        catch (error) {
            throw new PermissionlessError(`Failed to parse configuration file: ${error}`);
        }
        this.validateConfig(this.config);
    }
    validateConfig(config) {
        if (!config.roles || typeof config.roles !== 'object') {
            throw new PermissionlessError('Configuration must include roles object');
        }
        // Validate each role
        Object.entries(config.roles).forEach(([roleName, role]) => {
            if (!Array.isArray(role.permissions)) {
                throw new PermissionlessError(`Role ${roleName} must have permissions array`);
            }
            if (role.inherits && !Array.isArray(role.inherits)) {
                throw new PermissionlessError(`Role ${roleName} inherits must be an array`);
            }
        });
    }
    getRolePermissions(roleName, visited = new Set()) {
        if (this.cache.has(roleName)) {
            return this.cache.get(roleName);
        }
        const role = this.config.roles[roleName];
        if (!role) {
            throw new PermissionlessError(`Role ${roleName} not found`);
        }
        if (visited.has(roleName)) {
            throw new PermissionlessError(`Circular inheritance detected in role: ${roleName}`);
        }
        visited.add(roleName);
        const permissions = new Set(role.permissions);
        if (role.inherits) {
            for (const inheritedRole of role.inherits) {
                const inheritedPermissions = this.getRolePermissions(inheritedRole, visited);
                inheritedPermissions.forEach((perm) => permissions.add(perm));
            }
        }
        const result = Array.from(permissions);
        this.cache.set(roleName, result);
        return result;
    }
    matchesWildcard(permission, requested) {
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
    hasPermission(user, permission, context) {
        var _a, _b, _c;
        const cacheKey = `${user.id}:${permission}:${context || ''}`;
        // This is a cache for the permission check result
        if (this.permissionCache.has(cacheKey)) {
            return this.permissionCache.get(cacheKey);
        }
        // Existing permission check logic
        const userOverrides = ((_a = this.config.users) === null || _a === void 0 ? void 0 : _a[user.id]) || {};
        const fullPermission = context ? `${permission}:${context}` : permission;
        let result = false;
        if ((_b = userOverrides.denies) === null || _b === void 0 ? void 0 : _b.some((denied) => this.matchesWildcard(denied, fullPermission))) {
            result = false;
        }
        else if ((_c = userOverrides.permissions) === null || _c === void 0 ? void 0 : _c.some((granted) => this.matchesWildcard(granted, fullPermission))) {
            result = true;
        }
        else {
            const rolePermissions = this.getRolePermissions(user.role);
            result = rolePermissions.some((perm) => this.matchesWildcard(perm, fullPermission));
        }
        // Cache the result
        this.permissionCache.set(cacheKey, result);
        return result;
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
    getPermissionsForRole(role) {
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
     * @emits roleAdded - Emitted when a role is added
     *
     * @example
     * ```ts
     * permissions.addRole('moderator', ['moderate:comments'], ['viewer']);
     * ```
     */
    addRole(roleName, permissions, inherits) {
        if (this.config.roles[roleName]) {
            throw new PermissionlessError(`Role ${roleName} already exists`);
        }
        this.config.roles[roleName] = { permissions, inherits };
        this.clearInternalCache();
        this.emit('roleAdded', { roleName, permissions, inherits });
        this.logAudit('addRole', { roleName, permissions, inherits });
    }
    /**
     * Removes a role from the configuration.
     *
     * @param roleName - The name of the role to remove
     * @throws Error if role does not exist or is inherited by other roles
     *
     * @emits roleRemoved - Emitted when a role is removed
     *
     * @example
     * ```ts
     * permissions.removeRole('moderator');
     * ```
     */
    removeRole(roleName) {
        if (!this.config.roles[roleName]) {
            throw new PermissionlessError(`Role ${roleName} does not exist`);
        }
        const inheritingRoles = Object.entries(this.config.roles)
            .filter(([_, role]) => { var _a; return (_a = role.inherits) === null || _a === void 0 ? void 0 : _a.includes(roleName); })
            .map(([roleName]) => roleName);
        if (inheritingRoles.length > 0) {
            throw new PermissionlessError(`Cannot remove role ${roleName} as it is inherited by roles: ${inheritingRoles.join(', ')}`);
        }
        delete this.config.roles[roleName];
        this.clearInternalCache();
        this.emit('roleRemoved', { roleName });
        this.logAudit('removeRole', { roleName });
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
    addPermissionToRole(roleName, permission) {
        const role = this.config.roles[roleName];
        if (!role) {
            throw new PermissionlessError(`Role ${roleName} not found`);
        }
        role.permissions.push(permission);
        this.clearInternalCache();
    }
    /**
     * Clears the internal permissions cache.
     * Call this after making changes to roles or permissions.
     */
    clearCache() {
        this.permissionCache.clear();
        this.cache.clear();
    }
    clearInternalCache() {
        this.permissionCache.clear();
        this.cache.clear();
        this.memoWildcardMatch.clear();
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
    async loadConfigFromApi(apiUrl) {
        const response = await axios_1.default.get(apiUrl);
        if (response.status !== 200) {
            throw new PermissionlessError(`Failed to load configuration from ${apiUrl}`);
        }
        this.config = response.data;
        this.clearInternalCache();
        this.validateConfig(this.config);
    }
    /**
     * Loads permission configuration from Firebase Firestore.
     *
     * @param collection - The Firestore collection where the config is stored
     * @param documentId - The document ID containing the config
     * @throws Error if the Firestore request fails or returns invalid config
     *
     * @example
     * ```ts
     * const firestore = new Firestore();
     * await permissions.loadConfigFromFirestore('permissionlessConfig', 'config');
     * ```
     */
    async loadConfigFromFirestore(collection = 'permissionlessConfig', documentId = 'config') {
        if (!this.firestore) {
            throw new PermissionlessError('Firestore instance is not initialized.');
        }
        try {
            const doc = await this.firestore
                .collection(collection)
                .doc(documentId)
                .get();
            if (!doc.exists) {
                throw new PermissionlessError(`Configuration document '${documentId}' does not exist in collection '${collection}'.`);
            }
            const data = doc.data();
            this.validateConfig(data);
            this.config = data;
            this.clearCache();
        }
        catch (error) {
            throw new PermissionlessError(`Failed to load configuration from Firestore: ${error}`);
        }
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
    listRoles() {
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
    listUsers() {
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
    hasRole(roleName) {
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
    checkMultiplePermissions(user, permissions, context) {
        return permissions.every((permission) => this.hasPermission(user, permission, context));
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
    checkAnyPermission(user, permissions, context) {
        return permissions.some((permission) => this.hasPermission(user, permission, context));
    }
}
exports.Permissionless = Permissionless;
exports.default = Permissionless;
