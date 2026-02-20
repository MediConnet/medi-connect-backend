# 🇪🇨 Lista de Ciudades de Ecuador - Para Backend

**Fecha:** 20 de febrero de 2026  
**Para:** Equipo Backend  
**Asunto:** Corrección de ciudades en la base de datos

---

## ⚠️ Problema Identificado

En el selector de ciudades del formulario de registro aparece **"Queti"**, que es un error de tipeo. Debe ser **"Quito"**.

---

## ✅ Lista Correcta de Ciudades Principales de Ecuador

### Ciudades por Provincia (Capitales Provinciales):

```sql
-- Provincias y sus capitales
INSERT INTO cities (name, state) VALUES
-- Costa
('Guayaquil', 'Guayas'),
('Manta', 'Manabí'),
('Portoviejo', 'Manabí'),
('Machala', 'El Oro'),
('Esmeraldas', 'Esmeraldas'),
('Santo Domingo', 'Santo Domingo de los Tsáchilas'),
('Quevedo', 'Los Ríos'),
('Babahoyo', 'Los Ríos'),
('Santa Elena', 'Santa Elena'),
('Salinas', 'Santa Elena'),

-- Sierra
('Quito', 'Pichincha'),
('Cuenca', 'Azuay'),
('Ambato', 'Tungurahua'),
('Riobamba', 'Chimborazo'),
('Loja', 'Loja'),
('Ibarra', 'Imbabura'),
('Latacunga', 'Cotopaxi'),
('Tulcán', 'Carchi'),
('Guaranda', 'Bolívar'),
('Azogues', 'Cañar'),

-- Oriente (Amazonía)
('Puyo', 'Pastaza'),
('Tena', 'Napo'),
('Macas', 'Morona Santiago'),
('Nueva Loja', 'Sucumbíos'),
('Francisco de Orellana', 'Orellana'),
('Zamora', 'Zamora Chinchipe'),

-- Galápagos
('Puerto Baquerizo Moreno', 'Galápagos'),
('Puerto Ayora', 'Galápagos');
```

---

## 📊 Lista Simplificada (Top 20 Ciudades)

Para un selector más manejable, estas son las 20 ciudades más importantes:

1. **Quito** (Pichincha) - Capital del país
2. **Guayaquil** (Guayas) - Ciudad más poblada
3. **Cuenca** (Azuay)
4. **Santo Domingo** (Santo Domingo de los Tsáchilas)
5. **Machala** (El Oro)
6. **Manta** (Manabí)
7. **Portoviejo** (Manabí)
8. **Ambato** (Tungurahua)
9. **Riobamba** (Chimborazo)
10. **Loja** (Loja)
11. **Esmeraldas** (Esmeraldas)
12. **Quevedo** (Los Ríos)
13. **Ibarra** (Imbabura)
14. **Latacunga** (Cotopaxi)
15. **Babahoyo** (Los Ríos)
16. **Salinas** (Santa Elena)
17. **Tulcán** (Carchi)
18. **Tena** (Napo)
19. **Puyo** (Pastaza)
20. **Azogues** (Cañar)

---

## 🔧 Corrección Requerida

### Opción 1: Actualizar registro existente
```sql
-- Corregir "Queti" a "Quito"
UPDATE cities 
SET name = 'Quito' 
WHERE name = 'Queti';
```

### Opción 2: Eliminar y recrear
```sql
-- Eliminar datos incorrectos
DELETE FROM cities WHERE name = 'Queti';

-- Insertar datos correctos
INSERT INTO cities (name, state) VALUES ('Quito', 'Pichincha');
```

---

## 📋 Estructura Recomendada

### Tabla `cities`:
```sql
CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas rápidas
CREATE INDEX idx_cities_name ON cities(name);
CREATE INDEX idx_cities_state ON cities(state);
```

---

## 🎯 Endpoint Actual

**Endpoint:** `GET /api/public/cities`

**Respuesta esperada:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "name": "Quito",
      "state": "Pichincha"
    },
    {
      "id": "uuid-2",
      "name": "Guayaquil",
      "state": "Guayas"
    },
    {
      "id": "uuid-3",
      "name": "Cuenca",
      "state": "Azuay"
    }
    // ... más ciudades
  ]
}
```

---

## 🗺️ Regiones de Ecuador

Para referencia, Ecuador se divide en 4 regiones:

### 1. Costa (Litoral)
- Guayas, Manabí, El Oro, Esmeraldas, Los Ríos, Santa Elena, Santo Domingo

### 2. Sierra (Interandina)
- Pichincha, Azuay, Tungurahua, Chimborazo, Loja, Imbabura, Cotopaxi, Carchi, Bolívar, Cañar

### 3. Oriente (Amazonía)
- Pastaza, Napo, Morona Santiago, Sucumbíos, Orellana, Zamora Chinchipe

### 4. Insular (Galápagos)
- Galápagos

---

## ✅ Checklist de Corrección

- [ ] Verificar datos actuales en la tabla `cities`
- [ ] Corregir "Queti" a "Quito"
- [ ] Verificar que todas las ciudades principales estén incluidas
- [ ] Verificar ortografía de todas las ciudades
- [ ] Probar endpoint `GET /api/public/cities`
- [ ] Confirmar que el frontend muestra las ciudades correctamente

---

## 📸 Evidencia del Problema

El usuario reportó que en el selector de ciudades aparece:
- Cuenca ✅
- Guayaquil ✅
- **Queti** ❌ (debe ser "Quito")
- Quito ✅ (probablemente duplicado)

---

## 🚀 Prioridad

**ALTA** - Este es un error visible para todos los usuarios que se registran en la plataforma.

---

## 📞 Contacto

Si necesitan la lista completa de todas las ciudades de Ecuador (221 cantones), puedo proporcionarla.

---

**Por favor corregir este error en la base de datos lo antes posible.** 🙏
