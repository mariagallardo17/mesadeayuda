<?php

namespace App\Services;

use App\Config\Database;

class NotificationService
{
    private $db;
    
    public function __construct()
    {
        $this->db = Database::getInstance();
    }
    
    /**
     * Crea una notificación en la base de datos
     * 
     * @param int $idUsuario ID del usuario que recibirá la notificación
     * @param string $mensaje Mensaje de la notificación
     * @param int $idTicket ID del ticket relacionado (requerido)
     * @param string $tipo Tipo de notificación: 'Correo', 'WhatsApp', 'Interna' (default: 'Interna')
     * @return bool True si se creó exitosamente, false en caso contrario
     */
    public function createNotification($idUsuario, $mensaje, $idTicket, $tipo = 'Interna')
    {
        try {
            // Validar tipo
            $validTypes = ['Correo', 'WhatsApp', 'Interna'];
            if (!in_array($tipo, $validTypes)) {
                $tipo = 'Interna';
            }
            
            // Validar que id_usuario, mensaje e id_ticket estén presentes
            if (empty($idUsuario) || empty($mensaje) || empty($idTicket)) {
                error_log("❌ Error creando notificación: id_usuario, mensaje o id_ticket vacíos");
                return false;
            }
            
            $sql = 'INSERT INTO notificaciones (id_usuario, mensaje, tipo, id_ticket, fecha_envio, leida) VALUES (?, ?, ?, ?, NOW(), 0)';
            $params = [$idUsuario, $mensaje, $tipo, $idTicket];
            
            $this->db->query($sql, $params);
            
            error_log("✅ Notificación creada exitosamente para usuario $idUsuario, ticket $idTicket");
            return true;
            
        } catch (\Exception $e) {
            error_log("❌ Error creando notificación: " . $e->getMessage());
            error_log("❌ Stack trace: " . $e->getTraceAsString());
            return false;
        }
    }
    
    /**
     * Crea notificación cuando se crea un ticket
     * 
     * @param int $idUsuario ID del usuario (empleado) que creó el ticket
     * @param int $idTicket ID del ticket creado
     * @param string|null $tecnicoNombre Nombre del técnico asignado (opcional)
     * @return bool
     */
    public function notifyTicketCreated($idUsuario, $idTicket, $tecnicoNombre = null)
    {
        $mensaje = "Tu ticket #{$idTicket} ha sido creado exitosamente";
        if ($tecnicoNombre) {
            $mensaje .= ". Técnico asignado: {$tecnicoNombre}";
        } else {
            $mensaje .= ". Está en proceso de asignación";
        }
        
        return $this->createNotification($idUsuario, $mensaje, $idTicket, 'Interna');
    }
    
    /**
     * Crea notificación cuando se asigna un ticket a un técnico
     * 
     * @param int $idTecnico ID del técnico al que se asignó el ticket
     * @param int $idTicket ID del ticket asignado
     * @param string $empleadoNombre Nombre del empleado que creó el ticket
     * @return bool
     */
    public function notifyTicketAssigned($idTecnico, $idTicket, $empleadoNombre = '')
    {
        $mensaje = "Se te ha asignado un nuevo ticket #{$idTicket}";
        if ($empleadoNombre) {
            $mensaje .= " de {$empleadoNombre}";
        }
        
        return $this->createNotification($idTecnico, $mensaje, $idTicket, 'Interna');
    }
    
    /**
     * Crea notificación cuando cambia el estado de un ticket
     * 
     * @param int $idUsuario ID del usuario (empleado o técnico) que debe recibir la notificación
     * @param int $idTicket ID del ticket
     * @param string $nuevoEstado Nuevo estado del ticket
     * @param string|null $estadoAnterior Estado anterior del ticket (opcional)
     * @return bool
     */
    public function notifyStatusChange($idUsuario, $idTicket, $nuevoEstado, $estadoAnterior = null)
    {
        if ($estadoAnterior) {
            $mensaje = "El ticket #{$idTicket} cambió de estado de '{$estadoAnterior}' a '{$nuevoEstado}'";
        } else {
            $mensaje = "El ticket #{$idTicket} cambió a estado '{$nuevoEstado}'";
        }
        
        return $this->createNotification($idUsuario, $mensaje, $idTicket, 'Interna');
    }
    
    /**
     * Crea notificación cuando se cierra un ticket
     * 
     * @param int $idUsuario ID del usuario (empleado) propietario del ticket
     * @param int $idTicket ID del ticket cerrado
     * @return bool
     */
    public function notifyTicketClosed($idUsuario, $idTicket)
    {
        $mensaje = "Tu ticket #{$idTicket} ha sido cerrado. Por favor, evalúalo cuando sea posible.";
        
        return $this->createNotification($idUsuario, $mensaje, $idTicket, 'Interna');
    }
    
    /**
     * Crea notificación cuando se finaliza un ticket
     * 
     * @param int $idUsuario ID del usuario (empleado) propietario del ticket
     * @param int $idTicket ID del ticket finalizado
     * @return bool
     */
    public function notifyTicketFinalized($idUsuario, $idTicket)
    {
        $mensaje = "Tu ticket #{$idTicket} ha sido finalizado. Por favor, evalúalo cuando sea posible.";
        
        return $this->createNotification($idUsuario, $mensaje, $idTicket, 'Interna');
    }
    
    /**
     * Crea notificación cuando se escala un ticket
     * 
     * @param int $idUsuario ID del usuario (nuevo técnico o empleado) que debe recibir la notificación
     * @param int $idTicket ID del ticket escalado
     * @param string $motivo Motivo del escalamiento (opcional)
     * @return bool
     */
    public function notifyTicketEscalated($idUsuario, $idTicket, $motivo = '')
    {
        $mensaje = "El ticket #{$idTicket} ha sido escalado";
        if ($motivo) {
            $mensaje .= ". Motivo: {$motivo}";
        }
        
        return $this->createNotification($idUsuario, $mensaje, $idTicket, 'Interna');
    }
    
    /**
     * Crea notificación cuando un ticket se marca como pendiente
     * 
     * @param int $idUsuario ID del usuario (empleado) propietario del ticket
     * @param int $idTicket ID del ticket
     * @param string|null $motivo Motivo de pendiente (opcional)
     * @return bool
     */
    public function notifyTicketPending($idUsuario, $idTicket, $motivo = null)
    {
        $mensaje = "El ticket #{$idTicket} ha sido marcado como pendiente";
        if ($motivo) {
            $mensaje .= ". Motivo: {$motivo}";
        }
        
        return $this->createNotification($idUsuario, $mensaje, $idTicket, 'Interna');
    }
}

