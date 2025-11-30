-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: 127.0.0.2    Database: mesadeayuda
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `escalamientos`
--

DROP TABLE IF EXISTS `escalamientos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `escalamientos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_ticket` int NOT NULL,
  `tecnico_original_id` int NOT NULL,
  `tecnico_nuevo_id` int DEFAULT NULL,
  `nivel_escalamiento` varchar(50) NOT NULL,
  `persona_enviar` int NOT NULL,
  `motivo_escalamiento` text NOT NULL,
  `fecha_escalamiento` datetime DEFAULT CURRENT_TIMESTAMP,
  `fecha_resolucion` datetime DEFAULT NULL,
  `estatus` enum('pendiente','asignado','resuelto','cerrado') DEFAULT 'pendiente',
  PRIMARY KEY (`id`),
  KEY `persona_enviar` (`persona_enviar`),
  KEY `idx_escalamientos_ticket` (`id_ticket`),
  KEY `idx_escalamientos_tecnico_original` (`tecnico_original_id`),
  KEY `idx_escalamientos_tecnico_nuevo` (`tecnico_nuevo_id`),
  KEY `idx_escalamientos_fecha` (`fecha_escalamiento`),
  KEY `idx_escalamientos_estatus` (`estatus`),
  CONSTRAINT `escalamientos_ibfk_1` FOREIGN KEY (`id_ticket`) REFERENCES `tickets` (`id_ticket`) ON DELETE CASCADE,
  CONSTRAINT `escalamientos_ibfk_2` FOREIGN KEY (`tecnico_original_id`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE,
  CONSTRAINT `escalamientos_ibfk_3` FOREIGN KEY (`tecnico_nuevo_id`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL,
  CONSTRAINT `escalamientos_ibfk_4` FOREIGN KEY (`persona_enviar`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `escalamientos`
--

LOCK TABLES `escalamientos` WRITE;
/*!40000 ALTER TABLE `escalamientos` DISABLE KEYS */;
/*!40000 ALTER TABLE `escalamientos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `evaluaciones`
--

DROP TABLE IF EXISTS `evaluaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `evaluaciones` (
  `id_evaluacion` int NOT NULL AUTO_INCREMENT,
  `id_ticket` int NOT NULL,
  `calificacion` int DEFAULT NULL,
  `comentario` text,
  `fecha_evaluacion` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_evaluacion`),
  UNIQUE KEY `id_ticket` (`id_ticket`),
  KEY `idx_evaluaciones_fecha_calificacion` (`fecha_evaluacion`,`calificacion`),
  CONSTRAINT `evaluaciones_ibfk_1` FOREIGN KEY (`id_ticket`) REFERENCES `tickets` (`id_ticket`),
  CONSTRAINT `evaluaciones_chk_1` CHECK ((`calificacion` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `evaluaciones`
--

LOCK TABLES `evaluaciones` WRITE;
/*!40000 ALTER TABLE `evaluaciones` DISABLE KEYS */;
/*!40000 ALTER TABLE `evaluaciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificaciones`
--

DROP TABLE IF EXISTS `notificaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificaciones` (
  `id_notificacion` int NOT NULL AUTO_INCREMENT,
  `id_ticket` int NOT NULL,
  `id_usuario` int NOT NULL,
  `tipo` enum('Correo','WhatsApp','Interna') NOT NULL,
  `mensaje` text NOT NULL,
  `fecha_envio` datetime DEFAULT CURRENT_TIMESTAMP,
  `leida` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id_notificacion`),
  KEY `id_ticket` (`id_ticket`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `notificaciones_ibfk_1` FOREIGN KEY (`id_ticket`) REFERENCES `tickets` (`id_ticket`),
  CONSTRAINT `notificaciones_ibfk_2` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificaciones`
--

LOCK TABLES `notificaciones` WRITE;
/*!40000 ALTER TABLE `notificaciones` DISABLE KEYS */;
/*!40000 ALTER TABLE `notificaciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `servicios`
--

DROP TABLE IF EXISTS `servicios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `servicios` (
  `id_servicio` int NOT NULL AUTO_INCREMENT,
  `requerimiento` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `categoria` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subcategoria` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tiempo_objetivo` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tiempo_maximo` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prioridad` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responsable_inicial` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `escalamiento` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `motivo_escalamiento` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nivel_servicio` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sla` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estatus` enum('Activo','Inactivo') COLLATE utf8mb4_unicode_ci DEFAULT 'Activo',
  `requiere_aprobacion` tinyint(1) DEFAULT '0',
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_servicio`)
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `servicios`
--

LOCK TABLES `servicios` WRITE;
/*!40000 ALTER TABLE `servicios` DISABLE KEYS */;
INSERT INTO `servicios` VALUES (1,'Conectividad','Internet','Falta de conexión','00:45:00','00:56:15','Alta','RITO','Especialista externo / proveedor','Incidencia crítica o falla persistente',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(2,'Conectividad','Internet','Acceso a internet','00:30:00','00:36:00','Media','RITO','RITO','Problema no resuelto en tiempo objetivo',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(3,'Conectividad','Internet','Acceso a página o aplicación','00:40:00','00:50:00','Media','RITO','RITO','Requiere permisos especiales o diagnóstico profundo',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(4,'Conectividad','Internet','Descargas de software','01:00:00','01:12:00','Media','RITO','RITO','Configuración especial o solicitud administrativa',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52'),(5,'Conectividad','Internet','Solicitud de red','01:00:00','01:12:00','Media','OSCAR','RITO','Configuración especial o solicitud administrativa',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52'),(6,'Telefonía','Telefonía IP','Instalación de teléfono IP','01:00:00','01:12:00','Alta','OSCAR','RITO','Configuración avanzada o falla técnica compleja',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52'),(7,'Telefonía','Telefonía IP','Creación de extensión','00:30:00','00:36:00','Media','OSCAR','RITO','Configuración especial o falla no resuelta',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52'),(8,'Telefonía','Telefonía IP','Caída de conexión','01:30:00','01:52:30','Alta','OSCAR','RITO','Incidencia crítica o falla grave',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(9,'Hardware','Equipo de cómputo','Mantenimiento preventivo','01:00:00','01:12:00','Media','OSCAR','RITO','Falla detectada durante mantenimiento',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(10,'Hardware','Equipo de cómputo','Mantenimiento correctivo','01:30:00','01:52:30','Alta','OSCAR','RITO','Problema persistente o falla no resuelta',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(11,'Hardware','Equipo de cómputo','Instalación de nuevo equipo','01:00:00','01:12:00','Media','OSCAR','RITO','Configuración especial o instalación compleja',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52'),(12,'Hardware','Equipo de cómputo','Falla de software','00:30:00','00:37:30','Alta','OSCAR','RITO','Problema complejo o interdependencia con otros sistemas',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(13,'Hardware','Equipo de cómputo','Reemplazo de equipo','01:00:00','01:12:00','Media','OSCAR','RITO','Daño persistente o problema recurrente',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52'),(14,'Hardware','Proyectores','No enciende','00:30:00','00:36:00','Media','OSCAR','RITO','Falla técnica mayor',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(15,'Hardware','Proyectores','Cambio de cable','00:30:00','00:36:00','Media','OSCAR','RITO','Falla técnica mayor',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(16,'Hardware','Proyectores','Mantenimieniento preventivo','00:30:00','00:36:00','Media','OSCAR','RITO','Falla técnica mayor',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(17,'Hardware','Proyectores','Mantenimieniento correctivo','00:30:00','00:36:00','Media','OSCAR','RITO','Falla técnica mayor',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(18,'Hardware','Proyectores','Instalación de nuevo proyector','01:00:00','01:12:00','Media','OSCAR','RITO','Integración con red o configuración compleja',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52'),(19,'Hardware','Impresoras','Falla de conexión','00:45:00','00:54:00','Media','OSCAR','RITO','Problema persistente o falla técnica',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(20,'Hardware','Impresoras','Papel atorado','00:45:00','00:54:00','Media','OSCAR','RITO','Problema persistente o falla técnica',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(21,'Hardware','Impresoras','Mantenimiento preventivo','00:45:00','00:54:00','Media','OSCAR','RITO','Falla recurrente o daño grave',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(22,'Hardware','Impresoras','Mantenimiento correctivo','00:45:00','00:54:00','Media','OSCAR','RITO','Falla recurrente o daño grave',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(23,'Hardware','Impresoras','Configuración','01:00:00','01:12:00','Media','OSCAR','RITO','Configuración especial o permisos administrativos',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(24,'Hardware','Impresoras','Instalación','01:00:00','01:12:00','Media','OSCAR','RITO','Configuración especial o permisos administrativos',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(25,'Hardware','Impresoras','Reemplazo de tóner','00:30:00','00:36:00','Baja','OSCAR','RITO','Falta repetitiva o problema técnico',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(26,'Hardware','Copiadora','Falta de papel','00:20:00','00:24:00','Baja','OSCAR','RITO','Falta recurrente o daño mecánico',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(27,'Hardware','Copiadora','Falta de tóner','00:20:00','00:24:00','Baja','OSCAR','RITO','Falta recurrente o daño mecánico',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(28,'Hardware','Copiadora','Mantenimiento preventivo','01:00:00','01:12:00','Media','OSCAR','RITO','Problema persistente o falla grave',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(29,'Hardware','Copiadora','Mantenimiento correctivo','01:00:00','01:12:00','Media','OSCAR','RITO','Problema persistente o falla grave',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(30,'Correo','Correo','Creación de correo','00:40:00','00:48:00','Media','RITO','Especialista externo / proveedor','Configuración compleja o integración con otros sistemas',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52'),(31,'Correo','Correo','Actualización de correo','00:40:00','00:48:00','Media','RITO','Especialista externo / proveedor','Configuración compleja o integración con otros sistemas',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(32,'Correo','Correo','Mantenimiento','01:00:00','01:15:00','Alta','RITO','Especialista externo / proveedor','Falla crítica del servidor o incidencia prolongada',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(33,'Correo','Correo','Sin acceso','01:00:00','01:15:00','Alta','RITO','Especialista externo / proveedor','Falla crítica del servidor o incidencia prolongada',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(34,'Correo','Correo','Caída','01:00:00','01:15:00','Alta','RITO','Especialista externo / proveedor','Falla crítica del servidor o incidencia prolongada',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(35,'Software','Connect','Consulta de información','00:30:00','00:36:00','Baja','ADRIAN','RITO','Problema técnico complejo',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(36,'Software','Connect','Captura calificaciones','01:00:00','01:15:00','Media','ADRIAN','RITO','Falla persistente o incidencia crítica',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(37,'Software','Connect','Caída del sistema','02:00:00','02:36:00','Crítica','RITO','Especialista externo / proveedor','Falla grave de infraestructura',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(38,'Software','Teams','Modificaciones','00:30:00','00:36:00','Media','ADRIAN','RITO','Configuración compleja o fallo persistente',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(39,'Software','Teams','Actualización de datos','00:30:00','00:36:00','Media','ADRIAN','RITO','Configuración compleja o fallo persistente',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(40,'Software','Teams','Creación de cuentas','01:00:00','01:15:00','Alta','ADRIAN','RITO','Autorizaciones especiales o fallas de integración',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(41,'Software','Teams','Creación de grupos','01:00:00','01:15:00','Alta','RITO','RITO','Autorizaciones especiales o fallas de integración',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52'),(42,'Software','Outlook','Instalación','01:30:00','01:52:30','Media','ADRIAN','RITO','Problema técnico mayor',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(43,'Software','Outlook','Respaldo','01:30:00','01:52:30','Media','ADRIAN','RITO','Problema técnico mayor',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(44,'Software','Outlook','Sincronización','01:30:00','01:52:30','Media','ADRIAN','RITO','Problema técnico mayor',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(45,'Software','Control Escolar','Bloqueo de pagos','00:30:00','00:36:00','Media','ADRIAN','RITO','Problema persistente o solicitud administrativa especial',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(46,'Software','Control Escolar','Desbloqueo de pagos','00:30:00','00:36:00','Media','ADRIAN','RITO','Problema persistente o solicitud administrativa especial',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(47,'Software','Puntos DH','Caída','01:30:00','01:52:30','Alta','ADRIAN','RITO','Falla grave del sistema',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(48,'Software','Puntos DH','Respaldo de datos','01:30:00','01:52:30','Alta','ADRIAN','RITO','Falla grave del sistema',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(49,'Software','Office','Instalación','01:00:00','01:15:00','Media','ADRIAN','RITO','Configuración compleja o fallo persistente',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(50,'Software','Office','Errores','01:00:00','01:15:00','Media','ADRIAN','RITO','Configuración compleja o fallo persistente',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(51,'Software','OneDrive','Respaldo','01:00:00','01:15:00','Media','ADRIAN','RITO','Configuración avanzada o fallo persistente',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(52,'Software','OneDrive','Sincronización','01:00:00','01:15:00','Media','ADRIAN','RITO','Configuración avanzada o fallo persistente',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(53,'Software','OneDrive','Cuenta','01:00:00','01:15:00','Media','ADRIAN','RITO','Configuración avanzada o fallo persistente',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(54,'Software','Desarrollo de software','Nuevo sistema','30 días','39 días','Crítica','ADRIAN','Especialista externo / proveedor','Proyecto complejo o integración avanzada',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52'),(55,'Software','Agendatec','Mantenimiento','01:00:00','01:15:00','Media','ADRIAN','RITO','Error crítico o actualización mayor',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(56,'Software','Agendatec','Errores en el sistema','01:00:00','01:15:00','Media','ADRIAN','RITO','Error crítico o actualización mayor',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(57,'Ayuda','Ayuda Soporte general','Apoyo de información','00:30:00','00:36:00','Baja','ADRIAN','RITO','Solicitud fuera de alcance o recurrente',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(58,'Red','Red interna','Acceso','01:30:00','01:52:30','Alta','OSCAR','RITO','Problema crítico de infraestructura',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(59,'Red','Red interna','Caída','01:30:00','01:52:30','Alta','OSCAR','RITO','Problema crítico de infraestructura',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(60,'Red','Red interna','Configuración','01:30:00','01:52:30','Alta','OSCAR','RITO','Problema crítico de infraestructura',NULL,NULL,'Activo',0,'2025-11-28 03:26:12','2025-11-28 03:26:12'),(61,'Red','Red interna','Nodo','01:30:00','01:52:30','Alta','OSCAR','RITO','Problema crítico de infraestructura',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52'),(62,'Red','Red interna','Servidor','01:30:00','01:52:30','Alta','OSCAR','RITO','Problema crítico de infraestructura',NULL,NULL,'Activo',1,'2025-11-28 03:26:12','2025-11-28 06:47:52');
/*!40000 ALTER TABLE `servicios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ticketreaperturas`
--

DROP TABLE IF EXISTS `ticketreaperturas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticketreaperturas` (
  `id_reapertura` int NOT NULL AUTO_INCREMENT,
  `id_ticket` int NOT NULL,
  `usuario_id` int NOT NULL,
  `tecnico_id` int DEFAULT NULL,
  `observaciones_usuario` text NOT NULL,
  `causa_tecnico` text,
  `fecha_reapertura` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_respuesta_tecnico` datetime DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `estado_reapertura` varchar(50) DEFAULT NULL COMMENT 'Estado del ticket al momento de la reapertura',
  PRIMARY KEY (`id_reapertura`),
  KEY `fk_reapertura_usuario` (`usuario_id`),
  KEY `fk_reapertura_tecnico` (`tecnico_id`),
  KEY `idx_ticketreaperturas_ticket_fecha` (`id_ticket`,`fecha_reapertura`),
  CONSTRAINT `fk_reapertura_tecnico` FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_reapertura_ticket` FOREIGN KEY (`id_ticket`) REFERENCES `tickets` (`id_ticket`),
  CONSTRAINT `fk_reapertura_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ticketreaperturas`
--

LOCK TABLES `ticketreaperturas` WRITE;
/*!40000 ALTER TABLE `ticketreaperturas` DISABLE KEYS */;
/*!40000 ALTER TABLE `ticketreaperturas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tickets`
--

DROP TABLE IF EXISTS `tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tickets` (
  `id_ticket` int NOT NULL AUTO_INCREMENT,
  `id_usuario` int NOT NULL,
  `id_servicio` int NOT NULL,
  `id_tecnico` int DEFAULT NULL,
  `descripcion` text NOT NULL,
  `prioridad` enum('Alta','Media','Baja') NOT NULL,
  `fecha_creacion` datetime DEFAULT CURRENT_TIMESTAMP,
  `fecha_asignacion` datetime DEFAULT NULL,
  `fecha_finalizacion` datetime DEFAULT NULL,
  `tiempo_restante_finalizacion` int DEFAULT NULL COMMENT 'Segundos restantes al finalizar (negativo si vencido)',
  `fecha_cierre` datetime DEFAULT NULL,
  `estatus` enum('Abierto','Pendiente','Escalado','En Progreso','Finalizado','Cerrado','Reabierto') DEFAULT 'Abierto',
  `pendiente_motivo` text,
  `pendiente_tiempo_estimado` varchar(100) DEFAULT NULL,
  `pendiente_actualizado_en` datetime DEFAULT NULL,
  `pendiente_actualizado_por` int DEFAULT NULL,
  `archivo_aprobacion` varchar(255) DEFAULT NULL COMMENT 'Nombre del archivo de carta de aprobación adjunto',
  `evaluacion_ultimo_recordatorio` datetime DEFAULT NULL COMMENT 'Fecha y hora del último recordatorio de evaluación enviado',
  `evaluacion_recordatorio_contador` int DEFAULT '0' COMMENT 'Número de recordatorios de evaluación enviados',
  `evaluacion_cierre_automatico` tinyint(1) DEFAULT '0' COMMENT 'Indica si el ticket fue cerrado automáticamente por evaluación tardía',
  `comentario_admin_tecnico` text COMMENT 'Comentario del administrador para el técnico cuando se regresa un ticket escalado. Solo visible para el técnico.',
  `evaluacion_ultimo_recordatorio_diario` datetime DEFAULT NULL COMMENT 'Fecha del último recordatorio diario enviado para este ticket',
  `fecha_inicio_atencion` datetime DEFAULT NULL COMMENT 'Fecha cuando el técnico abre el ticket (estado En Progreso por primera vez)',
  `tiempo_atencion_segundos` int DEFAULT NULL COMMENT 'Tiempo total de atención en segundos cuando el ticket fue finalizado',
  PRIMARY KEY (`id_ticket`),
  KEY `id_usuario` (`id_usuario`),
  KEY `id_servicio` (`id_servicio`),
  KEY `idx_tickets_archivo_aprobacion` (`archivo_aprobacion`),
  KEY `idx_tickets_fecha_prioridad` (`fecha_creacion`,`prioridad`),
  KEY `idx_tickets_tecnico_fecha_estatus` (`id_tecnico`,`fecha_creacion`,`estatus`),
  KEY `idx_tickets_fecha_asignacion` (`fecha_asignacion`),
  KEY `idx_tickets_fecha_cierre` (`fecha_cierre`),
  KEY `idx_tickets_fecha_inicio_atencion` (`fecha_inicio_atencion`),
  KEY `idx_tickets_tiempo_atencion` (`tiempo_atencion_segundos`),
  CONSTRAINT `tickets_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `tickets_ibfk_2` FOREIGN KEY (`id_servicio`) REFERENCES `servicios` (`id_servicio`),
  CONSTRAINT `tickets_ibfk_3` FOREIGN KEY (`id_tecnico`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tickets`
--

LOCK TABLES `tickets` WRITE;
/*!40000 ALTER TABLE `tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id_usuario` int NOT NULL AUTO_INCREMENT,
  `num_empleado` varchar(20) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `departamento` varchar(100) DEFAULT NULL,
  `correo` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` enum('administrador','tecnico','empleado') NOT NULL,
  `estatus` enum('Activo','Inactivo') DEFAULT 'Activo',
  `password_changed` tinyint(1) DEFAULT '0',
  `first_login` tinyint(1) DEFAULT '1',
  `password_temporal` tinyint(1) DEFAULT '1',
  `fecha_ultimo_cambio` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `num_empleado` (`num_empleado`),
  UNIQUE KEY `correo` (`correo`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (6,'EMP1758686369912','Monica Gallardo','Dirección','cj106558@gmail.com','$2b$10$hMcm8k5csoY8a7/9sGVBRuXDQaY.ZmbM.yYACnRfTN0ScVH/nhP/2','empleado','Activo',0,1,0,'2025-11-28 09:38:42'),(8,'LRS21110103','RITO','Administración','Lrs21110103@purisima.tecnm.mx','$2b$10$kJPo0zv5driOcl4mAK8TkuqCyoFYv0HOOp6SmB58Xy0KSo57Q4TyG','administrador','Activo',0,1,0,'2025-10-30 10:50:38'),(9,'EMP1759288065002','OSCAR','IT','Lrs21110076@purisima.tecnm.mx','$2b$10$GGxL9pTbSPu0iJBkuJsoguNzYwrHZF9wrsEbmh5MhNuzMs89tVeD2','tecnico','Activo',0,1,0,'2025-10-10 11:36:34'),(10,'EMP1759288117079','ADRIAN','IT','Lrs21110028@purisima.tecnm.mx','$2b$10$7Zz94VIcugFM7wEDDUwtUOTCfXABxLta08mtiYTo5Y5gZskn1S7QC','tecnico','Activo',0,1,0,'2025-11-14 23:27:29'),(11,'EMP1763177444587','Maria Guadalupe Gallardo','Jefaturas de división','mariagallardo761501@gmail.com','$2b$10$kuSnJyvixgkLMiLh3L4wfuAl1kyxLMS39BFgXG8gt50PKlgv8BSja','empleado','Activo',0,1,0,'2025-11-14 21:43:40');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `vistasatisfaccionusuario`
--

DROP TABLE IF EXISTS `vistasatisfaccionusuario`;
/*!50001 DROP VIEW IF EXISTS `vistasatisfaccionusuario`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vistasatisfaccionusuario` AS SELECT 
 1 AS `fecha`,
 1 AS `satisfaccion_promedio`,
 1 AS `total_evaluaciones`,
 1 AS `total_estrellas`,
 1 AS `evaluaciones_5_estrellas`,
 1 AS `evaluaciones_4_o_mas_estrellas`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `vistasatisfaccionusuario`
--

/*!50001 DROP VIEW IF EXISTS `vistasatisfaccionusuario`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vistasatisfaccionusuario` AS select cast(`evaluaciones`.`fecha_evaluacion` as date) AS `fecha`,avg(`evaluaciones`.`calificacion`) AS `satisfaccion_promedio`,count(0) AS `total_evaluaciones`,sum(`evaluaciones`.`calificacion`) AS `total_estrellas`,count((case when (`evaluaciones`.`calificacion` = 5) then 1 end)) AS `evaluaciones_5_estrellas`,count((case when (`evaluaciones`.`calificacion` >= 4) then 1 end)) AS `evaluaciones_4_o_mas_estrellas` from `evaluaciones` group by cast(`evaluaciones`.`fecha_evaluacion` as date) order by `fecha` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-30 11:47:06
