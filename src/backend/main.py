from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import logging
from connection_manager import ConnectionManager
from websocket_handlers import handle_websocket_connection

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configurar CORS con restricciones de seguridad
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Actualizar esto con tu dominio de Cloudflare cuando lo tengas
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Crear una única instancia de ConnectionManager
manager = ConnectionManager()

# WebSocket endpoint con manejo de sesiones
@app.websocket("/ws/agent")
async def websocket_endpoint(websocket: WebSocket, wallet_address: str | None = None):
    await handle_websocket_connection(websocket, wallet_address, manager)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="127.0.0.1",  # Cambiado a localhost ya que Cloudflare Tunnel se encargará de la exposición
        port=8000,
        reload=True
    ) 