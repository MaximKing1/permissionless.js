"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permissionless = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
class Permissionless {
    constructor(configFilePath = '.permissionless.json') {
        this.cache = new Map();
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
        var _a, _b, _c;
        const userOverrides = ((_a = this.config.users) === null || _a === void 0 ? void 0 : _a[user.id]) || {};
        const fullPermission = context ? `${permission}:${context}` : permission;
        // Check denies first
        if ((_b = userOverrides.denies) === null || _b === void 0 ? void 0 : _b.some((denied) => this.matchesWildcard(denied, fullPermission))) {
            return false;
        }
        // Check specific user permissions
        if ((_c = userOverrides.permissions) === null || _c === void 0 ? void 0 : _c.some((granted) => this.matchesWildcard(granted, fullPermission))) {
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
        const response = await axios_1.default.get(apiUrl);
        if (response.status !== 200) {
            throw new Error(`Failed to load configuration from ${apiUrl}`);
        }
        this.config = response.data;
        this.clearCache();
    }
}
exports.Permissionless = Permissionless;
exports.default = Permissionless;
