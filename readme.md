# 🪪 Permissionless.js: Role-Based Access Control for Node.js Projects

![NPM Downloads](https://img.shields.io/npm/dm/permissionless.js)
![NPM Collaborators](https://img.shields.io/npm/collaborators/permissionless.js)
![Static Badge](https://img.shields.io/badge/MIT%20-%20licence%20?label=Licence)
![NPM Type Definitions](https://img.shields.io/npm/types/permissionless.js)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/34154d8625d14484a0ca5be4151b8b9f)](https://app.codacy.com/gh/MaximKing1/permissionless.js/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)

`Permissionless` is a powerful and extensible TypeScript library designed to manage user roles and permissions in your application. It offers features such as role inheritance, wildcard permissions, contextual checks, and dynamic configuration updates. This was first created in-house for JMServices Pro, and made open source.

## Key Features

- 👑 **Role Inheritance**: Define hierarchical roles where permissions are inherited from parent roles.
- 👤 **User-Specific Overrides**: Grant or deny specific permissions to individual users.
- 🔍 **Contextual Permissions**: Check permissions with added context (e.g., `read:articles`).
- 🌟 **Wildcard Matching**: Use wildcards for permissions like `read:*` or `write:docs.*`.
- ⚡ **Dynamic Configuration**: Automatically reload changes to `.permissionless.json` or fetch from APIs.
- 🚀 **Caching for Performance**: Built-in caching to optimize repeated permission checks.
- 🏃 **Runtime Compatibility**: Works seamlessly with Bun, Deno & Node.js for maximum flexibility across different JavaScript runtimes.

---

## Installation

Install the package using npm or yarn:

```bash
npm install permissionless.js
```

```bash
yarn add permissionless.js
```

---

## Getting Started

### 1. Create a Configuration File

Define your roles, permissions, and user-specific overrides in `.permissionless.json`:

```json
{
  "roles": {
    "admin": {
      "permissions": ["read:*", "write:*", "delete:*"],
      "inherits": ["editor"]
    },
    "editor": {
      "permissions": ["read:articles", "write:articles"]
    },
    "viewer": {
      "permissions": ["read:articles"]
    }
  },
  "users": {
    "123": {
      "permissions": ["read:restricted-docs"],
      "denies": ["write:articles"]
    }
  }
}
```

### 2. Initialize Permissionless

Import and initialize the `Permissionless` class in your application:

```typescript
// CommonJS
const { Permissionless } = require('permissionless.js');
const permissions = new Permissionless();

// OR using ES Modules
import Permissionless from 'permissionless.js';
const permissions = new Permissionless();
```

### 3. Check Permissions

To check if a user has a specific permission, use the `hasPermission` method:

```typescript
const user = { id: '123', role: 'editor', ...restOfUser };

if (permissions.hasPermission(user, 'read', 'articles')) {
  console.log('User has permission');
} else {
  console.error('User does NOT have permission');
}
```

---

## Advanced Features

### Role Inheritance

Define roles with inherited permissions. In the example above, `admin` inherits all permissions from `editor`. You can specify multiple roles in the `inherits` array.

### User-Specific Overrides

Grant or deny specific permissions to individual users. For example:

```json
"users": {
  "123": {
    "permissions": ["read:restricted-docs"], // Extra permissions for this user
    "denies": ["write:articles"]            // Explicitly deny writing articles
  }
}
```

### Wildcard Permissions 🪪

Define generic permissions using `*`. For instance:

- `read:*` grants read access to all resources.
- `write:articles.*` grants write access to all sub-resources of `articles`.

### Contextual Permissions

Add context to permissions checks. Example:

```typescript
permissions.hasPermission(user, 'read', 'articles');
permissions.hasPermission(user, 'read', 'restricted-docs');
```

### Dynamic Configuration Reload

`Permissionless` watches for changes in `.permissionless.json` and reloads the configuration automatically. You can also fetch the configuration from an API:

```typescript
await permissions.loadConfigFromApi('https://example.com/permissions.json');
```

### Add or Modify Roles Programmatically

You can add or modify roles and permissions dynamically:

```typescript
permissions.addRole('superadmin', ['manage:users'], ['admin']);
permissions.addPermissionToRole('editor', 'edit:comments');
```

---

## API Reference

### `constructor(configFilePath?: string)`

- **Description**: Initializes `Permissionless` with the given configuration file.
- **Default**: `.permissionless.json`

### `hasPermission(user: User, permission: string, context?: string): boolean`

- **Description**: Checks if a user has the specified permission, optionally within a context.

### `getPermissionsForRole(role: string): string[]`

- **Description**: Retrieves all permissions for a specified role, including inherited ones.

### `addRole(roleName: string, permissions: string[], inherits?: string[]): void`

- **Description**: Adds a new role with optional inheritance from other roles.

### `addPermissionToRole(roleName: string, permission: string): void`

- **Description**: Adds a new permission to an existing role.

### `clearCache(): void`

- **Description**: Clears the internal cache of permissions.

### `loadConfigFromApi(apiUrl: string): Promise<void>`

- **Description**: Loads configuration from an external API URL.

---

## Example Usage

### Basic Permission Check

```typescript
const user = { id: '456', role: 'viewer', ...restOfUserConfig };

if (permissions.hasPermission(user, 'read', 'articles')) {
  console.log('Viewer can read articles');
} else {
  console.error('Viewer cannot read articles');
}
```

### Adding a New Role

```typescript
permissions.addRole('moderator', ['moderate:comments'], ['viewer']);
```

### Dynamic Permissions Update

```typescript
permissions.addPermissionToRole('viewer', 'read:docs');
```

### Advanced Wildcard and Contextual Matching

```typescript
const user = { id: '789', role: 'editor' };

if (permissions.hasPermission(user, 'read', 'articles.section1')) {
  console.log('Editor can read section 1 of articles');
}
```

---

## Configuration Reload

### File Watcher

`Permissionless` automatically reloads `.permissionless.json` when changes are detected. No additional setup is needed for this feature.

### Load Config from API

You can dynamically load configuration from an external API:

```typescript
await permissions.loadConfigFromApi('https://example.com/permissions');
```

---

## Performance Optimizations

- **Caching**: Permissionless uses in-memory caching for permission calculations. Clear the cache when roles or permissions are updated:

  ```typescript
  permissions.clearCache();
  ```

- **Lazy Loading**: Role permissions are calculated and cached only when accessed.

---

## Error Handling

- **Role Not Found**: If a role is missing in the configuration:

  ```
  Error: Role [roleName] not found
  ```

- **Circular Inheritance**: If roles inherit in a loop:

  ```
  Error: Circular inheritance detected in role: [roleName]
  ```

- **Invalid User Role**: If a user has an undefined role:
  ```
  Error: Role [user.role] not found
  ```

---

## License

Permissionless is distributed under the MIT License.

---

## Contribution

Contributions are welcome! Feel free to open issues or submit pull requests to improve Permissionless.
