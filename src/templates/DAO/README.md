# Customizable DAO Template

Este template proporciona un contrato inteligente para una DAO (Organización Autónoma Descentralizada) con un sistema de gobernanza simple y seguro.

## Características

- **Sistema de Membresía**: Cualquiera puede unirse a la DAO
- **Sistema de Propuestas**: Los miembros pueden crear propuestas ejecutables
- **Votación**: Sistema de votación simple (a favor/en contra)
- **Quórum**: Requiere un mínimo de participación para ejecutar propuestas
- **Mayoría**: Sistema de mayoría configurable para aprobar propuestas
- **Protección contra Reentrancia**: Implementa ReentrancyGuard de OpenZeppelin
- **Período de Votación**: Tiempo configurable para votar propuestas

## Parámetros Constantes

El contrato incluye las siguientes constantes configurables:

- `VOTING_PERIOD`: Duración del período de votación (7 días por defecto)
- `QUORUM_PERCENTAGE`: Porcentaje mínimo de participación requerido (4% por defecto)
- `MAJORITY_PERCENTAGE`: Porcentaje necesario para aprobar una propuesta (51% por defecto)

## Estructuras de Datos

### Proposal
```solidity
struct Proposal {
    uint256 id;                  // ID único de la propuesta
    string description;          // Descripción de la propuesta
    address target;             // Contrato objetivo a ejecutar
    bytes data;                 // Datos de la llamada a ejecutar
    uint256 forVotes;           // Votos a favor
    uint256 againstVotes;       // Votos en contra
    uint256 snapshotTotalMembers; // Total de miembros al crear la propuesta
    uint256 deadline;           // Fecha límite de votación
    bool executed;              // Estado de ejecución
}
```

## Funciones Principales

### Gestión de Membresía
- `join()`: Permite a una dirección unirse a la DAO
- `getMembers()`: Retorna la lista de todos los miembros

### Gestión de Propuestas
- `createProposal(string memory _description, address _target, bytes memory _calldata)`: Crea una nueva propuesta
- `vote(uint256 proposalId, bool support)`: Permite votar en una propuesta
- `executeProposal(uint256 proposalId)`: Ejecuta una propuesta aprobada

## Eventos

El contrato emite los siguientes eventos:

- `ProposalCreated`: Cuando se crea una nueva propuesta
- `VoteCast`: Cuando un miembro emite un voto
- `ProposalExecuted`: Cuando se ejecuta una propuesta
- `MemberJoined`: Cuando un nuevo miembro se une a la DAO

## Ejemplo de Uso

```solidity
// Despliegue del contrato
CustomizableDAO dao = new CustomizableDAO();

// Unirse a la DAO
dao.join();

// Crear una propuesta
bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", recipient, amount);
dao.createProposal(
    "Transferir tokens",
    tokenContract,
    data
);

// Votar en una propuesta
dao.vote(0, true); // Votar a favor de la propuesta 0

// Ejecutar una propuesta aprobada
dao.executeProposal(0);
```

## Flujo de Trabajo de una Propuesta

1. Un miembro crea una propuesta especificando:
   - Descripción
   - Contrato objetivo
   - Datos de la llamada a ejecutar

2. Los miembros tienen 7 días para votar:
   - Pueden votar a favor o en contra
   - Cada miembro solo puede votar una vez

3. Después del período de votación:
   - La propuesta puede ser ejecutada si:
     - Se alcanzó el quórum (4% de participación)
     - Se alcanzó la mayoría (51% de votos a favor)

## Seguridad

El contrato incluye varias medidas de seguridad:

- Protección contra reentrancia en la ejecución de propuestas
- Verificación de membresía para acciones críticas
- Comprobaciones de estado para propuestas
- Períodos de votación fijos
- Snapshot del total de miembros al crear propuestas

## Consideraciones

1. El deployer del contrato se convierte automáticamente en el primer miembro
2. Las propuestas no pueden ser canceladas una vez creadas
3. Los votos no pueden ser cambiados una vez emitidos
4. Las propuestas solo pueden ser ejecutadas una vez
5. El período de votación y los porcentajes son inmutables después del despliegue

## Licencia

Este contrato está bajo la licencia MIT. 