# 🏷️ Implementação de Siglas para Funcionários

## Objectivo

Permitir que cada funcionário tenha múltiplas siglas associadas ao seu perfil. Estas siglas servem para agrupar comissões nos mapas de vendas e análises financeiras.

**Exemplo:**
- **Funcionário:** Maria Silva
- **Departamento:** Digital
- **Siglas:** `CG 25`, `CG 70`

Quando se extraem mapas de vendas ou gráficos, todas as vendas com as siglas `CG 25` ou `CG 70` aparecerão como uma única entidade: "Maria Silva - Digital".

## Estrutura da Base de Dados

### Tabela: `user_siglas`

```sql
CREATE TABLE user_siglas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sigla TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relação:**
- Um funcionário (`profiles`) pode ter **múltiplas siglas** (relação 1:N)
- Cada sigla está associada a **um único funcionário**

**Exemplo de dados:**
```
| profile_id | sigla  |
|------------|--------|
| uuid-123   | CG 25  |
| uuid-123   | CG 70  |
| uuid-456   | MR 10  |
```

## Componentes UI

### 1. SiglasInput (`components/forms/SiglasInput.tsx`)

Componente reutilizável para adicionar/remover siglas com interface de badges/tags.

**Features:**
- ✅ Input com conversão automática para maiúsculas
- ✅ Adicionar sigla com botão "+" ou tecla Enter
- ✅ Validação de siglas duplicadas
- ✅ Remover sigla individualmente com botão "X"
- ✅ Contador de siglas adicionadas
- ✅ Mensagens informativas

**Exemplo de uso:**
```tsx
<SiglasInput
  value={siglas}
  onChange={setSiglas}
  label="SIGLAS DO FUNCIONÁRIO"
  placeholder="Digite uma sigla (ex: CG 25) e pressione Enter"
/>
```

### 2. CreateUserForm (actualizado)

O formulário de criação/edição de utilizadores agora inclui:
- ✅ Campo de **Departamento** (dropdown)
- ✅ Campo de **Siglas** (componente SiglasInput)

## API Endpoints

### 1. Criar Utilizador - `POST /api/users/create`

**Body:**
```json
{
  "email": "maria@imacx.pt",
  "password": "senha123",
  "first_name": "Maria",
  "last_name": "Silva",
  "role_id": "uuid-role",
  "departamento_id": 5,
  "siglas": ["CG 25", "CG 70"]
}
```

**Fluxo:**
1. Cria utilizador no Supabase Auth
2. Cria perfil na tabela `profiles`
3. **Insere siglas na tabela `user_siglas`** (se fornecidas)

### 2. Actualizar Utilizador - `PUT /api/users/{id}`

**Body:**
```json
{
  "first_name": "Maria",
  "last_name": "Silva",
  "departamento_id": 5,
  "siglas": ["CG 25", "CG 70", "MR 15"]
}
```

**Fluxo:**
1. Actualiza perfil na tabela `profiles`
2. **Elimina siglas antigas** do utilizador
3. **Insere novas siglas** (se fornecidas)

### 3. Listar Utilizadores - `GET /api/users/list`

**Response:**
```json
{
  "users": [
    {
      "id": "uuid-profile",
      "first_name": "Maria",
      "last_name": "Silva",
      "departamento_id": 5,
      "siglas": ["CG 25", "CG 70"]
    }
  ]
}
```

As siglas são carregadas automaticamente com JOIN na query:
```sql
SELECT profiles.*, user_siglas.sigla
FROM profiles
LEFT JOIN user_siglas ON profiles.id = user_siglas.profile_id
```

## Como Usar na Aplicação

### 1. Na Página de Utilizadores (`/definicoes/utilizadores`)

1. **Criar novo utilizador:**
   - Clicar em "ADICIONAR UTILIZADOR"
   - Preencher dados (nome, email, função, departamento)
   - Adicionar siglas no campo "SIGLAS DO FUNCIONÁRIO"
   - Guardar

2. **Editar utilizador existente:**
   - Clicar no botão de editar (lápis)
   - As siglas existentes aparecem como badges
   - Adicionar novas siglas ou remover existentes
   - Guardar

### 2. Nos Mapas de Vendas (futuro)

Quando extrair mapas de vendas, as queries devem:

```sql
-- Exemplo: Agrupar vendas por funcionário usando siglas
SELECT 
  p.first_name || ' ' || p.last_name AS funcionario,
  d.nome AS departamento,
  SUM(v.valor) AS total_vendas
FROM vendas v
JOIN user_siglas us ON v.vendedor_sigla = us.sigla
JOIN profiles p ON us.profile_id = p.id
LEFT JOIN departamentos d ON p.departamento_id = d.id
GROUP BY p.id, funcionario, departamento
```

## Exemplos Práticos

### Cenário 1: Funcionário com Múltiplas Siglas

**Dados:**
- Nome: João Santos
- Departamento: Comercial
- Siglas: `JS 01`, `JS 02`, `JS 10`

**Resultado nos mapas:**
Todas as vendas com siglas `JS 01`, `JS 02` ou `JS 10` aparecem agrupadas como:
```
João Santos - Comercial: €50,000
```

### Cenário 2: Funcionário sem Siglas

**Dados:**
- Nome: Ana Costa
- Departamento: Administrativo
- Siglas: _(nenhuma)_

**Resultado:**
Funcionário não aparece nos mapas de comissões (não tem siglas associadas).

## Validações Implementadas

✅ Siglas são convertidas para **MAIÚSCULAS** automaticamente
✅ Siglas **duplicadas** são detectadas e rejeitadas na UI
✅ Siglas são **trimmed** (espaços removidos antes/depois)
✅ Não é possível adicionar sigla **vazia**
✅ Erros na API não bloqueiam criação do utilizador (apenas log de aviso)

## Segurança (RLS Policies)

```sql
-- Utilizadores autenticados podem ler todas as siglas
CREATE POLICY "Users can read all siglas"
  ON user_siglas FOR SELECT
  TO authenticated
  USING (true);

-- Utilizadores podem gerir as suas próprias siglas
CREATE POLICY "Users can manage own siglas"
  ON user_siglas FOR ALL
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Service role pode gerir todas as siglas
CREATE POLICY "Service role can manage all siglas"
  ON user_siglas FOR ALL
  TO service_role
  USING (true);
```

## Testes

### Teste 1: Criar utilizador com siglas

```bash
curl -X POST http://localhost:3000/api/users/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@imacx.pt",
    "password": "teste123",
    "first_name": "Teste",
    "last_name": "Silva",
    "role_id": "role-uuid",
    "departamento_id": 1,
    "siglas": ["TEST 01", "TEST 02"]
  }'
```

### Teste 2: Actualizar siglas

```bash
curl -X PUT http://localhost:3000/api/users/{user_id} \
  -H "Content-Type: application/json" \
  -d '{
    "siglas": ["TEST 03", "TEST 04", "TEST 05"]
  }'
```

### Teste 3: Verificar siglas na BD

```sql
SELECT 
  p.first_name || ' ' || p.last_name AS funcionario,
  d.nome AS departamento,
  STRING_AGG(us.sigla, ', ') AS siglas
FROM profiles p
LEFT JOIN departamentos d ON p.departamento_id = d.id
LEFT JOIN user_siglas us ON us.profile_id = p.id
GROUP BY p.id, funcionario, d.nome
ORDER BY funcionario;
```

## Próximos Passos

1. ✅ Estrutura da BD criada
2. ✅ Componente UI implementado
3. ✅ APIs de criação/edição actualizadas
4. ✅ Integração no formulário de utilizadores
5. ⏳ Integração com mapas de vendas (próxima fase)
6. ⏳ Relatórios de comissões agrupados por funcionário

## Notas Técnicas

- As siglas são armazenadas como **texto simples** (não há tabela de siglas pré-definidas)
- É responsabilidade do utilizador garantir consistência nas siglas
- A funcionalidade é **opcional** - funcionários podem não ter siglas
- Delete cascade: ao eliminar um funcionário, as siglas são eliminadas automaticamente

---

📅 **Implementado:** 2025-01-13
👤 **Por:** Claude Code Assistant
