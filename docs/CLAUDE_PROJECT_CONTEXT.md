# 🏁 F1 25 Telemetry Dashboard - Contexto do Projeto

## O Que É Este Projeto?
Um sistema de telemetria em tempo real para o jogo F1 25 (EA Sports) que captura dados via UDP e exibe informações de todos os 22 pilotos simultaneamente em um dashboard web interativo.

## Problema que Resolve
- Jogadores de F1 25 querem analisar sua performance em tempo real
- Dados nativos do jogo são limitados e não permitem análise profunda
- Não existe ferramenta open-source moderna em React/TypeScript
- Soluções existentes são pagas ou desatualizadas

## Objetivo Principal
**Criar uma aplicação web que receba telemetria UDP do F1 25 e mostre:**
- Posições em tempo real de todos os pilotos
- Velocidade, marcha, throttle, brake de cada carro
- Tempos de volta, deltas, gaps
- Status dos pneus, combustível, ERS
- Temperatura de freios e motor
- Comparação com outros pilotos
- Histórico da sessão para análise posterior

## Stack Tecnológico
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js UDP Server
- **Estado**: Zustand ou Context API
- **Gráficos**: Recharts ou D3.js
- **Estilo**: TailwindCSS
- **Testes**: Vitest + Testing Library

## Arquitetura Simplificada
```
F1 25 Game → UDP Port 20777 → Node.js Server → Parse Buffers → 
→ Update Store → React Hooks → UI Components → Dashboard
```

## Dados Disponíveis via UDP
O jogo envia 15 tipos de pacotes diferentes em tempo real:
- **Motion**: Posição XYZ, velocidade, forças G
- **Session**: Clima, temperatura, tipo de sessão
- **Lap Data**: Tempos, posições, status
- **Car Telemetry**: Velocidade, RPM, temperaturas
- **Car Status**: Combustível, pneus, ERS, danos
- **Participants**: Nomes dos pilotos, equipes

## Funcionalidades Core (MVP)
1. ✅ Conexão UDP e parsing de pacotes
2. ✅ Identificação de todos os pilotos
3. ✅ Display de telemetria básica (posição, velocidade, volta)
4. ⏳ Dashboard React com dados em tempo real
5. ⏳ Destaque do carro do jogador
6. ⏳ Gráficos de velocidade e tempos

## Funcionalidades Futuras
- Gravação e replay de sessões
- Comparação de voltas (ghost)
- Análise de setup ideal
- Exportação de dados (CSV/JSON)
- Modo multiplayer (vários jogadores)
- Predição de estratégia
- Mapa do circuito com posições

## Estrutura de Desenvolvimento

### Fase 1: Backend (✅ Completo)
- Parser UDP funcionando
- Validação robusta de buffers
- Todos os tipos de pacotes suportados

### Fase 2: Frontend Básico (🔄 Em Progresso)
- Components React para visualização
- Hooks para acessar dados
- Dashboard principal

### Fase 3: Features Avançadas
- Gráficos interativos
- Análise de performance
- Persistência de dados

## Desafios Técnicos
1. **Performance**: Processar 20-60 pacotes/segundo sem lag
2. **Buffer Safety**: Dados binários podem estar corrompidos
3. **Real-time Updates**: UI deve atualizar suavemente
4. **Memory Management**: Evitar memory leaks com stream contínuo
5. **Network**: UDP não garante ordem ou entrega

## Decisões de Design
- **Modular**: Cada parser em arquivo separado
- **Type-safe**: TypeScript strict mode
- **Reactive**: Store emite eventos, React consome
- **Fail-safe**: Nunca crashar por dados inválidos
- **Performático**: Target 60 FPS no frontend

## Como Testar
1. Iniciar F1 25 (PC/Console)
2. Ativar telemetria UDP nas configurações
3. Iniciar servidor Node.js (porta 20777)
4. Abrir dashboard React (localhost:3000)
5. Entrar em qualquer sessão no jogo
6. Dados aparecem automaticamente

## Métricas de Sucesso
- Zero crashes em 1h de uso
- Latência < 50ms do jogo para tela
- Memory usage < 200MB
- CPU < 15% em hardware médio
- 60 FPS no dashboard

## Comandos Úteis
```bash
npm run dev          # Frontend React
npm run server       # Backend UDP
npm run test         # Testes
npm run build        # Build produção
```

## Notas para Implementação
- SEMPRE validar tamanho do buffer antes de ler
- Usar little-endian para todos os números
- SessionUID é BigInt, não Number
- Máximo 22 carros (índices 0-21)
- Player index pode mudar durante sessão
- Alguns campos são signed, outros unsigned

## Estado Atual
- ✅ Backend completo e testado
- ✅ Tipos TypeScript definidos
- 🔄 Componentes React em desenvolvimento
- ⏳ Dashboard principal pendente
- ⏳ Gráficos não implementados

## Prioridade Agora
1. Criar componente de tabela de pilotos
2. Implementar hooks de telemetria
3. Adicionar atualização em tempo real
4. Estilizar com TailwindCSS
5. Adicionar gráfico de velocidade

## Referências Rápidas
- Porta UDP: 20777
- Formato F1 25: 2025
- Taxa recomendada: 20Hz
- Header size: 29 bytes
- Max packet: 1460 bytes