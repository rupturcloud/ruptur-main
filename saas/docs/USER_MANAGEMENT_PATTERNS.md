# User Management - Design Patterns & Clean Code

---

## 🎨 DESIGN PATTERNS ESSENCIAIS

### **1. Role-Based Guard Pattern** (Autorização)

```javascript
// ✅ BOM: Declarativo e composável
function useAuthorization() {
  const { user, capabilities } = useAuth();
  
  const can = (action) => capabilities.includes(action);
  
  return { can };
}

// Uso:
function UserManagement() {
  const { can } = useAuthorization();
  
  return (
    <div>
      {can('manage_users') && <UserTable />}
      {can('invite_users') && <InviteButton />}
      {!can('delete_users') && <DisabledDeleteButton />}
    </div>
  );
}

// ❌ RUIM: Hardcoded
if (user.role === 'admin') {
  // pode deletar
}
```

---

### **2. Optimistic Update Pattern** (UX responsiva)

```javascript
// ✅ BOM: Atualiza UI imediatamente
async function updateUserRole(userId, newRole) {
  // 1. Snapshot do estado anterior
  const previousUsers = [...users];
  
  // 2. Atualizar UI imediatamente
  setUsers(users.map(u => 
    u.id === userId 
      ? { ...u, role: newRole, syncing: true } 
      : u
  ));

  try {
    // 3. Fazer API call
    const result = await api.updateUserRole(userId, newRole);
    
    // 4. Atualizar com resposta do servidor
    setUsers(users.map(u => 
      u.id === userId 
        ? { ...u, ...result, syncing: false } 
        : u
    ));
    
    toast.success('Role updated');
  } catch (error) {
    // 5. Se falhar, reverter
    setUsers(previousUsers);
    toast.error(error.message);
  }
}

// ❌ RUIM: Esperar servidor (UX lenta)
async function updateUserRoleSlow(userId, newRole) {
  const result = await api.updateUserRole(userId, newRole);
  // Só agora atualizar UI
  setUsers(users.map(u => 
    u.id === userId ? { ...u, role: result.role } : u
  ));
}
```

---

### **3. Real-time Subscription Pattern** (Sync entre abas)

```javascript
// ✅ BOM: Sincronização automática
function useUsersTenant(tenantId) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // 1. Buscar dados iniciais
    fetchUsers(tenantId).then(setUsers);

    // 2. Inscrever em mudanças
    const subscription = supabase
      .from('user_tenant_roles')
      .on('INSERT', (payload) => {
        setUsers(prev => [payload.new, ...prev]);
        toast.info(`${payload.new.email} joined`);
      })
      .on('UPDATE', (payload) => {
        setUsers(prev => prev.map(u => 
          u.id === payload.new.id ? payload.new : u
        ));
      })
      .on('DELETE', (payload) => {
        setUsers(prev => prev.filter(u => u.id !== payload.old.id));
      })
      .subscribe();

    // 3. Cleanup
    return () => subscription.unsubscribe();
  }, [tenantId]);

  return { users, isLoading: users.length === 0 };
}

// ❌ RUIM: Polling (heavy on server)
setInterval(() => {
  fetchUsers(tenantId).then(setUsers);
}, 5000);
```

---

### **4. Modal Composition Pattern** (Modais reutilizáveis)

```javascript
// ✅ BOM: Modal genérico + hook
function useModal(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);
  
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(!isOpen)
  };
}

// Usar em qualquer lugar
function UserManagement() {
  const inviteModal = useModal();
  const confirmRemoveModal = useModal();
  
  return (
    <>
      <InviteButton onClick={inviteModal.open} />
      
      <InviteModal
        isOpen={inviteModal.isOpen}
        onClose={inviteModal.close}
        onConfirm={() => {
          // ação
          inviteModal.close();
        }}
      />
      
      <ConfirmDialog
        isOpen={confirmRemoveModal.isOpen}
        title="Remove user?"
        onConfirm={() => {
          // ação
          confirmRemoveModal.close();
        }}
      />
    </>
  );
}

// ❌ RUIM: Modais hardcoded em cada página
```

---

### **5. Service Layer Pattern** (Lógica separada)

```javascript
// ✅ BOM: Lógica em service, componente apenas renderiza
class UserManagementService {
  constructor(supabase) {
    this.db = supabase;
  }

  async getTeamUsers(tenantId) {
    return this.db
      .from('user_tenant_roles')
      .select('*, auth.users(email, user_metadata)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');
  }

  async updateUserRole(userId, tenantId, newRole) {
    // 1. Validar permissão
    const hasPermission = await this.canModifyUsers(tenantId);
    if (!hasPermission) throw new Error('No permission');

    // 2. Validar último admin
    if (newRole !== 'admin') {
      const adminCount = await this.getAdminCount(tenantId);
      if (adminCount === 1) throw new Error('Cannot remove last admin');
    }

    // 3. Atualizar
    const result = await this.db
      .from('user_tenant_roles')
      .update({ role: newRole })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    // 4. Log de auditoria
    await this.logAudit('role_changed', {
      userId, tenantId, newRole
    });

    return result;
  }

  private async logAudit(action, details) {
    await this.db
      .from('audit_logs')
      .insert({
        action,
        ...details,
        created_at: new Date()
      });
  }
}

// ✅ Componente apenas orquestra
function UserManagement() {
  const service = useService(UserManagementService);
  const [users, setUsers] = useState([]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const result = await service.updateUserRole(userId, tenantId, newRole);
      setUsers(/* update UI */);
      toast.success('Role updated');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return <UserTable users={users} onRoleChange={handleRoleChange} />;
}

// ❌ RUIM: Lógica complexa no componente
function UserManagementBad() {
  const handleRoleChange = async (userId, newRole) => {
    // Tudo aqui: validação, API, logs, UI
    const { data: users } = await supabase.from('user_tenant_roles')...
    // ... 50 linhas de lógica
  };
}
```

---

### **6. Error Boundary Pattern** (Tratamento de erros)

```javascript
// ✅ BOM: Error boundary para capturar crashes
class UserManagementErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('User management crashed:', error, errorInfo);
    // Enviar para Sentry/monitoring
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          title="Oops! User management failed"
          message={this.state.error.message}
          action={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <UserManagementErrorBoundary>
      <UserManagement />
    </UserManagementErrorBoundary>
  );
}

// ❌ RUIM: Sem tratamento, página cai
```

---

### **7. Controlled Form Pattern** (Validação em tempo real)

```javascript
// ✅ BOM: Validação controlada
function InviteModal({ onConfirm, onClose }) {
  const [form, setForm] = useState({ email: '', role: 'member' });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    
    if (!form.email) newErrors.email = 'Email required';
    if (!isValidEmail(form.email)) newErrors.email = 'Invalid email';
    if (!form.role) newErrors.role = 'Role required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Validação em tempo real (remove erro quando usuário começa a digitar)
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    try {
      await onConfirm(form);
      onClose();
    } catch (error) {
      // Erros do servidor
      setErrors({ submit: error.message });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        value={form.email}
        onChange={(e) => handleChange('email', e.target.value)}
        error={errors.email}
      />
      
      <Select
        value={form.role}
        onChange={(e) => handleChange('role', e.target.value)}
        error={errors.role}
      />
      
      <Button type="submit">Invite</Button>
      {errors.submit && <ErrorMessage>{errors.submit}</ErrorMessage>}
    </form>
  );
}

// ❌ RUIM: Sem validação
function InviteModalBad() {
  return (
    <form onSubmit={() => {
      // Enviar direto, sem validar
      onConfirm({ email: emailInput.value, role: roleSelect.value });
    }}>
      ...
    </form>
  );
}
```

---

## 🧹 CLEAN CODE PRINCIPLES

### **1. Naming: Nomes claros e descritivos**

```javascript
// ✅ BOM
function canUserManageTeamMembers(userId, tenantId) {
  return hasCapability(userId, tenantId, 'manage_users');
}

const INVITE_EXPIRATION_DAYS = 7;
const MAX_INVITES_PER_HOUR = 10;

function isInviteExpired(inviteExpiresAt) {
  return new Date(inviteExpiresAt) < new Date();
}

// ❌ RUIM
function canDo(u, t) { // Nomes muito curtos
  return check(u, t, 'mu'); // Abreviações
}

const DAYS = 7; // Muito vago
const LIMIT = 10; // Qual limite?

function expired(d) {
  return d < Date.now(); // Confuso
}
```

---

### **2. Single Responsibility Principle**

```javascript
// ✅ BOM: Cada função faz uma coisa
async function getUserById(userId) {
  return supabase.from('user_tenant_roles').select('*').eq('id', userId);
}

function formatUserForDisplay(user) {
  return {
    displayName: user.email.split('@')[0],
    joinedDate: new Date(user.created_at).toLocaleDateString(),
    statusBadge: user.status === 'active' ? '🟢' : '⚪'
  };
}

function renderUserRow(user) {
  const formatted = formatUserForDisplay(user);
  return <tr>
    <td>{formatted.displayName}</td>
    <td>{formatted.joinedDate}</td>
    <td>{formatted.statusBadge}</td>
  </tr>;
}

// ❌ RUIM: Uma função faz tudo
async function getUserAndRender(userId) {
  const user = await supabase.from('user_tenant_roles').select('*').eq('id', userId);
  const displayName = user.email.split('@')[0];
  const joinedDate = new Date(user.created_at).toLocaleDateString();
  
  return <tr>
    <td>{displayName}</td>
    <td>{joinedDate}</td>
  </tr>;
}
```

---

### **3. DRY (Don't Repeat Yourself)**

```javascript
// ✅ BOM: Criar helper para validação comum
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return EMAIL_REGEX.test(email);
}

function validateInviteEmail(email) {
  if (!email) return 'Email required';
  if (!isValidEmail(email)) return 'Invalid email format';
  return null;
}

// Reusar em qualquer lugar
const emailError = validateInviteEmail(inputEmail);
const signupEmailError = validateInviteEmail(signupEmail);

// ❌ RUIM: Repetir validação
function inviteModal() {
  const validateEmail = (e) => {
    if (!e) return 'Email required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Invalid';
  };
}

function signupForm() {
  const validateEmail = (e) => {
    if (!e) return 'Email required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Invalid';
  };
}
```

---

### **4. Keep Functions Small**

```javascript
// ✅ BOM: Funções pequenas, fáceis de testar
async function removeUserFromTenant(userId, tenantId) {
  validateUserCanRemove(userId, tenantId);
  await softDeleteUser(userId, tenantId);
  await invalidateUserTokens(userId, tenantId);
  await logAudit('user_removed', { userId, tenantId });
  return { success: true };
}

async function softDeleteUser(userId, tenantId) {
  const { error } = await supabase
    .from('user_tenant_roles')
    .update({
      status: 'inactive',
      deleted_at: new Date(),
      deleted_by: currentUserId
    })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}

async function invalidateUserTokens(userId, tenantId) {
  // Apenas invalidar tokens desse usuário
  await supabase
    .from('user_tenant_roles')
    .update({ token_invalidated_at: new Date() })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);
}

// ❌ RUIM: 100+ linhas em uma função
async function removeUserFromTenant(userId, tenantId) {
  // Validação
  const { data: user } = await supabase.from('user_tenant_roles').select('*').eq('user_id', userId);
  // ... 20 linhas de validação
  
  // Soft delete
  await supabase.from('user_tenant_roles').update({ status: 'inactive' }).eq('user_id', userId);
  // ... 20 linhas de update
  
  // Invalidar tokens
  // ... 20 linhas
  
  // Log
  // ... 20 linhas
  
  // Return
  // ... más práticas
}
```

---

### **5. Avoid Magic Numbers**

```javascript
// ✅ BOM: Constantes com nomes descritivos
const INVITE_EXPIRATION_HOURS = 24 * 7; // 7 days
const MAX_USERS_PER_PAGE = 25;
const INVITE_RATE_LIMIT_PER_HOUR = 10;
const MIN_ADMINS_REQUIRED = 1;

function canInviteMoreUsers(sentThisHour) {
  return sentThisHour < INVITE_RATE_LIMIT_PER_HOUR;
}

// ❌ RUIM: Números soltos
if (sentThisHour < 10) { // Por que 10?
  // ...
}

const expiredDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // O que é 7*24*60*60*1000?
```

---

### **6. Use Type Checking (TypeScript)**

```typescript
// ✅ BOM: Tipos definem contrato
interface UserRole {
  id: string;
  userId: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'suspended' | 'inactive';
  createdAt: Date;
}

interface InviteUser {
  email: string;
  role: UserRole['role'];
}

async function inviteUser(
  tenantId: string, 
  invite: InviteUser
): Promise<{ success: boolean; error?: string }> {
  // Tipo garante que role é válido
  if (!['owner', 'admin', 'member'].includes(invite.role)) {
    return { success: false, error: 'Invalid role' };
  }
}

// ❌ RUIM: Sem tipos
async function inviteUser(tenantId, invite) {
  // Sem saber se invite tem email, role, etc.
  // Role pode ser 'super-admin' ou qualquer coisa
}
```

---

### **7. Comments: Apenas para o "POR QUÊ"**

```javascript
// ✅ BOM: Comments explicam decisões
function canRemoveUser(userId, tenantId) {
  // Não permitir remover o último admin do tenant
  // Motivo: tenant fica órfão sem ninguém para gerenciar
  const adminCount = getActiveAdminsCount(tenantId);
  return adminCount > 1 || userRole(userId) !== 'admin';
}

// ❌ RUIM: Comments redundantes (código já diz o quê)
// Pegar o email do usuário
const email = user.email;

// Deletar o usuário
await db.delete(userId);

// Se o usuário não existe, retornar erro
if (!user) {
  return error;
}
```

---

## 🔍 CHECKLIST: ANTES DE MERGEAR

### **Code Quality**
- [ ] Sem `any` em TypeScript (todos os tipos definidos)
- [ ] Sem `console.log` em produção
- [ ] Sem hardcoded credentials ou secrets
- [ ] Sem duplicação de código
- [ ] Funções com menos de 50 linhas

### **Security**
- [ ] Validação de input (email, role)
- [ ] RLS policies testadas
- [ ] Rate limiting implementado
- [ ] Soft deletes em vez de hard deletes
- [ ] Audit logs para ações críticas
- [ ] CORS headers configurado

### **Testing**
- [ ] Unit tests para serviços
- [ ] Integration tests para fluxos críticos
- [ ] E2E tests para user journeys
- [ ] Edge cases cobertos (último admin, invite expirado, etc.)
- [ ] Tests de segurança (RLS, permissions)

### **Performance**
- [ ] Paginação implementada (não carregar todos usuarios)
- [ ] Índices no banco (tenant_id, user_id, status)
- [ ] Queries otimizadas (não N+1)
- [ ] Lazy loading em componentes grandes

### **UX**
- [ ] Mensagens de erro claras
- [ ] Loading states em chamadas async
- [ ] Confirmação em ações destrutivas
- [ ] Feedback visual (toast, badge)
- [ ] Acessibilidade (aria-labels, keyboard nav)

### **Documentation**
- [ ] README com setup instructions
- [ ] Comentários no código para lógica complexa
- [ ] Type definitions documentadas
- [ ] Errors documentados
- [ ] Fluxos críticos diagramados

---

**Próximo passo**: Começar com Phase 1 (Migrations) seguindo este documento como guia.
