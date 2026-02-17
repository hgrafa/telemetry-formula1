# Instruções para Claude Code - F1 25 Telemetry Project

## Visão Geral
Este é um sistema de telemetria em tempo real para F1 25/24 usando UDP.
O projeto está estruturado em TypeScript com React (frontend não implementado).

## Princípios de Desenvolvimento

### 1. Separação de Responsabilidades
- **UDPServer**: Apenas recebe pacotes UDP
- **Parsers**: Apenas fazem parsing de buffers binários
- **Store**: Gerencia estado e notifica mudanças
- **Hooks**: Interface React para acessar dados
- **Components**: Visualização (não implementado ainda)

### 2. Segurança de Buffer
SEMPRE validar tamanho do buffer antes de ler:
- Use funções safe (safeReadUInt8, etc)
- Verifique limites de array
- Trate erros graciosamente

### 3. Performance
- Parser deve processar < 1ms por pacote
- Store atualiza no máximo 60Hz
- UI atualiza no máximo 10Hz
- Use Web Workers para parsing pesado

### 4. Tipos TypeScript
- Todos os tipos em /types
- Strict mode habilitado
- Sem any, usar unknown quando necessário

## Tarefas Comuns

### Adicionar Novo Tipo de Pacote
1. Adicionar tipo em packets.d.ts
2. Criar parser em /parsers
3. Registrar no PacketParser.ts
4. Atualizar Store se necessário

### Otimizar Performance
1. Profile com Chrome DevTools
2. Mover parsing para Web Worker
3. Implementar throttling no Store
4. Use React.memo nos componentes

### Adicionar Nova Visualização
1. Criar hook em /hooks
2. Criar componente em /components
3. Usar dados do Store via hook
4. Implementar atualização eficiente

## Estrutura de Dados UDP

### Header (29 bytes)
- Sempre no início de cada pacote
- packetId determina tipo do resto do pacote
- sessionUID único por sessão

### Validação de Formato
- F1 25: packetFormat = 2025
- F1 24: packetFormat = 2024
- Rejeitar outros formatos

### Taxa de Atualização
- Configurável: 10Hz, 20Hz, 30Hz, 60Hz
- Recomendado: 20Hz para balance

## Estado Global

### TelemetryStore
- Single source of truth
- EventEmitter para mudanças
- Métodos síncronos
- Thread-safe (single-threaded JS)

### Fluxo de Dados
1. UDP Packet → UDPServer
2. UDPServer → PacketParser
3. PacketParser → Specific Parser
4. Parsed Data → TelemetryStore
5. Store → React Hooks
6. Hooks → Components

## Testes

### Unidade
- Cada parser tem teste próprio
- Mock de buffers binários
- Testar casos extremos

### Integração
- Testar fluxo completo
- Simular stream UDP
- Verificar performance

## Debugging

### Logs
- Use debug library
- Namespaces por módulo
- Níveis: error, warn, info, debug

### Ferramentas
- Wireshark para UDP
- Chrome DevTools para React
- VS Code debugger

## Deployment

### Desenvolvimento
- Vite dev server
- Hot module replacement
- Source maps habilitados

### Produção
- Build otimizado
- Minificação
- Tree shaking
- Lazy loading

## Limitações Conhecidas

1. UDP não tem garantia de entrega
2. Ordem de pacotes pode variar
3. Buffer overflow possível em 60Hz
4. Máximo 22 carros suportados
5. Sem criptografia nos dados
