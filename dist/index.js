"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const node_fetch_1 = __importDefault(require("node-fetch"));
class Permissionless {
    config;
    configFilePath;
    cache = new Map();
    constructor(configFilePath = '.permissionless.json') {
        this.configFilePath = path_1.default.resolve(process.cwd(), configFilePath);
        this.loadConfig();
        // Watch for changes to the config file
        fs_1.default.watch(this.configFilePath, (eventType) => {
            if (eventType === 'change') {
                console.log('Configuration file changed. Reloading...');
                this.loadConfig();
                this.clearCache();
            }
        });
    }
    loadConfig() {
        if (!fs_1.default.existsSync(this.configFilePath)) {
            throw new Error(`Configuration file not found at ${this.configFilePath}`);
        }
        const configFileContent = fs_1.default.readFileSync(this.configFilePath, 'utf-8');
        this.config = JSON.parse(configFileContent);
    }
    getRolePermissions(roleName, visited = new Set()) {
        if (this.cache.has(roleName)) {
            return this.cache.get(roleName);
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
            const regex = new RegExp(`^${permission.replace(/\*/g, '.*')}$`);
            return regex.test(requested);
        }
        return permission === requested;
    }
    hasPermission(user, permission, context) {
        const userOverrides = this.config.users?.[user.id] || {};
        const fullPermission = context ? `${permission}:${context}` : permission;
        // Check denies first
        if (userOverrides.denies?.some((denied) => this.matchesWildcard(denied, fullPermission))) {
            return false;
        }
        // Check specific user permissions
        if (userOverrides.permissions?.some((granted) => this.matchesWildcard(granted, fullPermission))) {
            return true;
        }
        // Check role-based permissions
        const rolePermissions = this.getRolePermissions(user.role);
        return rolePermissions.some((perm) => this.matchesWildcard(perm, fullPermission));
    }
    getPermissionsForRole(role) {
        return this.getRolePermissions(role);
    }
    addRole(roleName, permissions, inherits) {
        if (this.config.roles[roleName]) {
            throw new Error(`Role ${roleName} already exists`);
        }
        this.config.roles[roleName] = { permissions, inherits };
        this.clearCache();
    }
    addPermissionToRole(roleName, permission) {
        const role = this.config.roles[roleName];
        if (!role) {
            throw new Error(`Role ${roleName} not found`);
        }
        role.permissions.push(permission);
        this.clearCache();
    }
    clearCache() {
        this.cache.clear();
    }
    async loadConfigFromApi(apiUrl) {
        const response = await (0, node_fetch_1.default)(apiUrl);
        if (!response.ok) {
            throw new Error(`Failed to load configuration from ${apiUrl}`);
        }
        this.config = (await response.json());
        this.clearCache();
    }
}
exports.default = Permissionless;
