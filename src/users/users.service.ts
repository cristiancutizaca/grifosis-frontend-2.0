import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export interface ModulePermission {
  module: string;
  actions: string[];
}

export interface UserPermissions {
  modules: ModulePermission[];
  isAdmin: boolean;
}

export interface UserAuditLog {
  action: 'create' | 'update' | 'delete' | 'activate' | 'deactivate';
  performedBy: number;
  targetUser: number;
  timestamp: Date;
  details: any;
  previousData?: any;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) { }

  // ──────────────── [AGREGADO: anti-spam + micro-cache en memoria] ────────────────
  private readonly isProd = process.env.NODE_ENV === 'production';
  private readonly userCache = new Map<number, { value: User | null; exp: number }>();
  private static readonly TTL_MS = 10 * 60 * 1000; // 10 minutos
  private readonly lastLogAt = new Map<number, number>();
  private static readonly LOG_COOLDOWN_MS = 10_000; // 10s

  private devLogFindOne(id: number, data: any, tag = '') {
    if (this.isProd) return; // no logs en producción
    const now = Date.now();
    const next = this.lastLogAt.get(id) ?? 0;
    if (now < next) return; // throttle
    this.lastLogAt.set(id, now + UsersService.LOG_COOLDOWN_MS);
    console.log(`${tag} LLEGO AL FINDONE DE USERS`, data);
  }
  // ────────────────────────────────────────────────────────────────────────────────

  private readonly roleHierarchy = {
    'superadmin': 3,
    'admin': 2,
    'seller': 1
  };

  private readonly defaultPermissions = {
    superadmin: {
      modules: [
        { module: 'users', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'clients', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'sales', actions: ['create', 'read', 'update', 'delete', 'cancel'] },
        { module: 'payments', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'products', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'reports', actions: ['read', 'export'] },
        { module: 'settings', actions: ['read', 'update', 'backup', 'restore'] },
        { module: 'credits', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'expenses', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'suppliers', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'employees', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'tanks', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'pumps', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'nozzles', actions: ['create', 'read', 'update', 'delete'] }
      ],
      isAdmin: true
    },
    admin: {
      modules: [
        { module: 'users', actions: ['create', 'read', 'update'] },
        { module: 'clients', actions: ['create', 'read', 'update'] },
        { module: 'sales', actions: ['create', 'read', 'update'] },
        { module: 'payments', actions: ['create', 'read', 'update'] },
        { module: 'products', actions: ['create', 'read', 'update'] },
        { module: 'reports', actions: ['read', 'export'] },
        { module: 'credits', actions: ['create', 'read', 'update'] },
        { module: 'expenses', actions: ['create', 'read', 'update'] },
        { module: 'employees', actions: ['create', 'read', 'update'] },
        { module: 'suppliers', actions: ['create', 'read', 'update'] },
        { module: 'tanks', actions: ['read', 'update'] },
        { module: 'pumps', actions: ['read', 'update'] },
        { module: 'nozzles', actions: ['read', 'update'] }
      ],
      isAdmin: false
    },
    seller: {
      modules: [
        { module: 'clients', actions: ['read', 'update'] },
        { module: 'sales', actions: ['create', 'read'] },
        { module: 'payments', actions: ['create', 'read'] },
        { module: 'products', actions: ['read'] },
        { module: 'reports', actions: ['read'] },
        { module: 'credits', actions: ['read'] }
      ],
      isAdmin: false
    }
  };

  // ----------- MÉTODO CREATE SIN RESTRICCIÓN DE ROLES -----------
  async create(dto: CreateUserDto, creatorUser: any): Promise<User> {
    if (!this.roleHierarchy[dto.role]) {
      throw new BadRequestException(`Rol '${dto.role}' no es válido`);
    }

    const existingUser = await this.userRepo.findOne({
      where: { username: dto.username }
    });

    if (existingUser) {
      throw new BadRequestException('El nombre de usuario ya existe');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const defaultPerms = this.defaultPermissions[dto.role] || this.defaultPermissions.seller;

    const user = this.userRepo.create({
      username: dto.username,
      role: dto.role,
      password_hash: hashedPassword,
      permissions: JSON.stringify(dto.permissions || defaultPerms),
      is_active: true,
      employee_id: dto.employee_id ?? undefined,
      full_name: dto.full_name ?? undefined,
    });

    const savedUser = await this.userRepo.save(user);

    // Registrar auditoría
    await this.logUserAudit({
      action: 'create',
      performedBy: creatorUser.user_id,
      targetUser: savedUser.user_id,
      timestamp: new Date(),
      details: {
        username: savedUser.username,
        role: savedUser.role,
        createdBy: creatorUser.username
      }
    });

    return savedUser;
  }

  // ----------- FIND ALL -----------
  async findAll(): Promise<User[]> {
    return this.userRepo.find({
      select: ['user_id', 'username', 'role', 'permissions', 'is_active', 'created_at', 'updated_at', 'full_name', 'employee_id']
    });
  }

  // ----------- FIND ONE -----------
  async findOne(id: number): Promise<User> {
    // [AGREGADO] cache + throttle de logs
    const now = Date.now();
    const cached = this.userCache.get(id);
    if (cached && cached.exp > now) {
      this.devLogFindOne(id, { user_id: id, from: 'cache' }, '(cache)');
      if (!cached.value) throw new NotFoundException(`Usuario ${id} no encontrado`);
      return cached.value;
    }

    const user = await this.userRepo.findOne({
      where: { user_id: id },
      select: ['user_id', 'username', 'role', 'permissions', 'is_active', 'created_at', 'updated_at', 'full_name', 'employee_id']
    });

    // guarda en cache (incluso null) por 10 min
    this.userCache.set(id, { value: user ?? null, exp: now + UsersService.TTL_MS });

    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);

    this.devLogFindOne(id, {
      userId: user.user_id,
      username: user.username,
      role: user.role
    });

    return user;
  }

  // ----------- FIND BY USERNAME -----------
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username } });
  }

  // ----------- MÉTODO UPDATE SIN RESTRICCIÓN DE ROLES -----------
  async update(id: number, dto: UpdateUserDto, updaterUser: any): Promise<User> {
    const user = await this.userRepo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);

    const previousData = { ...user };

    // Ya no valida permisos por rol/cambios
    if (dto.password) {
      const hashed = await bcrypt.hash(dto.password, 10);
      user.password_hash = hashed;
    }

    if (dto.username && dto.username !== user.username) {
      const existingUser = await this.userRepo.findOne({
        where: { username: dto.username }
      });
      if (existingUser) {
        throw new BadRequestException('El nombre de usuario ya existe');
      }
      user.username = dto.username;
    }

    if (dto.role) {
      user.role = dto.role;
      if (!dto.permissions) {
        user.permissions = JSON.stringify(this.defaultPermissions[dto.role] || this.defaultPermissions.seller);
      }
    }

    if (dto.permissions) user.permissions = JSON.stringify(dto.permissions);
    if (dto.is_active !== undefined) user.is_active = dto.is_active;
    if (dto.full_name !== undefined) user.full_name = dto.full_name;
    if (dto.employee_id !== undefined) user.employee_id = dto.employee_id;

    const updatedUser = await this.userRepo.save(user);

    // invalidar cache del usuario actualizado
    this.userCache.delete(id);

    // Registrar auditoría
    await this.logUserAudit({
      action: 'update',
      performedBy: updaterUser.user_id,
      targetUser: updatedUser.user_id,
      timestamp: new Date(),
      details: {
        changes: dto,
        updatedBy: updaterUser.username
      },
      previousData: {
        username: previousData.username,
        role: previousData.role,
        is_active: previousData.is_active
      }
    });

    return updatedUser;
  }

  // ----------- MÉTODO REMOVE SIN RESTRICCIÓN DE ROLES -----------
  async remove(id: number, removerUser: any): Promise<void> {
    const user = await this.userRepo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);

    // Ya no valida permisos por rol
    await this.logUserAudit({
      action: 'delete',
      performedBy: removerUser.user_id,
      targetUser: user.user_id,
      timestamp: new Date(),
      details: {
        deletedUser: {
          username: user.username,
          role: user.role
        },
        deletedBy: removerUser.username
      }
    });

    await this.userRepo.remove(user);

    // invalidar cache
    this.userCache.delete(id);
  }

  // ----------- MÉTODO UPDATE PERMISSIONS (AÚN REQUIERE SUPERADMIN, PUEDES QUITARLO SI QUIERES) -----------
  async updatePermissions(id: number, permissions: UserPermissions, updaterUser: any): Promise<User> {
    const user = await this.userRepo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);

    // Si quieres quitar la restricción de solo superadmin, comenta esto:
    // if (updaterUser.role !== 'superadmin') {
    //   throw new ForbiddenException('Solo los superadmin pueden actualizar permisos');
    // }

    const previousPermissions = user.permissions;
    user.permissions = JSON.stringify(permissions);
    const updatedUser = await this.userRepo.save(user);

    // invalidar cache
    this.userCache.delete(id);

    await this.logUserAudit({
      action: 'update',
      performedBy: updaterUser.user_id,
      targetUser: updatedUser.user_id,
      timestamp: new Date(),
      details: {
        permissionsUpdated: true,
        updatedBy: updaterUser.username
      },
      previousData: {
        permissions: previousPermissions
      }
    });

    return updatedUser;
  }

  // ----------- RESTO IGUAL -----------
  async getUserPermissions(id: number): Promise<UserPermissions> {
    const user = await this.userRepo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);

    try {
      return user.permissions ? JSON.parse(user.permissions) : this.defaultPermissions[user.role] || this.defaultPermissions.seller;
    } catch {
      return this.defaultPermissions[user.role] || this.defaultPermissions.seller;
    }
  }

  async hasPermission(userId: number, module: string, action: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);

    if (permissions.isAdmin) return true;

    const modulePermission = permissions.modules.find(m => m.module === module);
    return modulePermission ? modulePermission.actions.includes(action) : false;
  }

  // ----------- MÉTODO ACTIVATE SIN RESTRICCIÓN DE ROLES -----------
  async activate(id: number, activatorUser: any): Promise<User> {
    const user = await this.userRepo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);

    // Ya no valida permisos por rol
    user.is_active = true;
    const updatedUser = await this.userRepo.save(user);

    // invalidar cache
    this.userCache.delete(id);

    await this.logUserAudit({
      action: 'activate',
      performedBy: activatorUser.user_id,
      targetUser: updatedUser.user_id,
      timestamp: new Date(),
      details: {
        activatedBy: activatorUser.username
      }
    });

    return updatedUser;
  }

  // ----------- MÉTODO DEACTIVATE SIN RESTRICCIÓN DE ROLES -----------
  async deactivate(id: number, deactivatorUser: any): Promise<User> {
    const user = await this.userRepo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);

    // Ya no valida permisos por rol
    user.is_active = false;
    const updatedUser = await this.userRepo.save(user);

    // invalidar cache
    this.userCache.delete(id);

    await this.logUserAudit({
      action: 'deactivate',
      performedBy: deactivatorUser.user_id,
      targetUser: updatedUser.user_id,
      timestamp: new Date(),
      details: {
        deactivatedBy: deactivatorUser.username
      }
    });

    return updatedUser;
  }

  // ----------- OTROS MÉTODOS -----------
  async getActiveUsers(): Promise<User[]> {
    return this.userRepo.find({
      where: { is_active: true },
      select: ['user_id', 'username', 'role', 'created_at', 'full_name']
    });
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return this.userRepo.find({
      where: { role },
      select: ['user_id', 'username', 'role', 'is_active', 'created_at', 'full_name']
    });
  }

  async validatePassword(username: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user || !user.is_active) return null;

    const isValid = await bcrypt.compare(password, user.password_hash);
    return isValid ? user : null;
  }

  async getCreatableRoles(userRole: string): Promise<string[]> {
    return ['superadmin', 'admin', 'seller']; // Ahora cualquiera puede crear cualquier rol
  }

  async canManageUser(managerRole: string, managerId: number, targetRole: string, targetId: number): Promise<boolean> {
    return true; // Todos pueden gestionar a todos (solo para pruebas)
  }

  /**
   * Registra una operación de auditoría (no cambia)
   */
  private async logUserAudit(auditData: UserAuditLog): Promise<void> {
    console.log('USER AUDIT LOG:', JSON.stringify(auditData, null, 2));
  }
}
 