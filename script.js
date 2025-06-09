class DICloakAPI {
    constructor() {
        // Actualizado para usar tu IP local
        this.baseUrl = 'http://192.168.18.1:52140/openapi'; 
        this.apiKey = '';
        this.teamId = null; 
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.teamId = null;
    }

    // Nuevo método: Obtener team_id automáticamente
    async getTeamId() {
        if (this.teamId) {
            return this.teamId;
        }

        try {
            console.log('🔍 === OBTENIENDO TEAM_ID AUTOMÁTICAMENTE ===');
            
            // Método 0: Intentar con team_id conocido primero
            const knownTeamId = '0KX61w0h';
            try {
                console.log(`🧪 Probando team_id conocido: ${knownTeamId}`);
                // Validar con algún endpoint que use team_id
                const testResult = await this.makeRequest(`/v1/env/group?team_id=${knownTeamId}`, 'GET');
                if (testResult.data) {
                    this.teamId = knownTeamId;
                    console.log(`✅ Team ID confirmado: ${this.teamId}`);
                    return this.teamId;
                }
            } catch (knownError) {
                console.log(`⚠️ Team ID conocido falló: ${knownError.message}`);
            }

            // Método 1: Intentar endpoint de perfil de usuario
            try {
                const profileResult = await this.makeRequest('/v1/user/profile', 'GET');
                if (profileResult.data?.team_id) {
                    this.teamId = profileResult.data.team_id;
                    console.log(`✅ Team ID desde perfil: ${this.teamId}`);
                    return this.teamId;
                }
            } catch (profileError) {
                console.log(`⚠️ Endpoint de perfil falló: ${profileError.message}`);
            }

            // Método 2: Extraer desde lista de miembros
            try {
                const membersResult = await this.makeRequest('/v1/members?page=1&size=1', 'GET');
                const firstMember = membersResult.data?.list?.[0];
                if (firstMember?.team_id) {
                    this.teamId = firstMember.team_id;
                    console.log(`✅ Team ID desde miembros: ${this.teamId}`);
                    return this.teamId;
                }
            } catch (membersError) {
                console.log(`⚠️ Extracción desde miembros falló: ${membersError.message}`);
            }

            // Método 3: Intentar endpoints de equipos
            const teamEndpoints = [
                '/v1/teams',
                '/v1/team/list',
                '/v1/user/teams'
            ];

            for (const endpoint of teamEndpoints) {
                try {
                    const result = await this.makeRequest(endpoint, 'GET');
                    const teams = result.data?.list || result.data || [];
                    if (Array.isArray(teams) && teams.length > 0) {
                        this.teamId = teams[0].id || teams[0].team_id;
                        console.log(`✅ Team ID desde ${endpoint}: ${this.teamId}`);
                        return this.teamId;
                    }
                } catch (endpointError) {
                    console.log(`⚠️ Endpoint ${endpoint} falló: ${endpointError.message}`);
                }
            }

            // Fallback: usar el team_id conocido si no se encontró otro
            if (!this.teamId) {
                console.log(`🔄 Usando team_id conocido como fallback: ${knownTeamId}`);
                this.teamId = knownTeamId;
                return this.teamId;
            }

            console.warn('⚠️ No se pudo obtener team_id automáticamente');
            return null;

        } catch (error) {
            console.error('❌ Error obteniendo team_id:', error);
            return null;
        }
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'X-API-KEY': this.apiKey,
                'Content-Type': 'application/json'
            }
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        try {
            console.log(`🔍 Haciendo petición ${method} a: ${url}`);
            if (data) console.log('📤 Datos enviados:', data);
            
            const response = await fetch(url, options);
            console.log(`📡 Status response: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Response error body:`, errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }
            
            const contentType = response.headers.get('content-type');
            let result;
            
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                const textResult = await response.text();
                console.warn(`⚠️ Respuesta no es JSON:`, textResult);
                throw new Error(`Respuesta inesperada del servidor: ${textResult}`);
            }
            
            console.log('📥 Respuesta recibida:', result);
            
            if (result.code !== 0) {
                throw new Error(result.msg || `Error de API (código: ${result.code})`);
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error detallado en solicitud API:', {
                url,
                method,
                error: error.message,
                stack: error.stack
            });
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Error de red: No se puede conectar a DICloak. Verifica que DICloak esté ejecutándose en http://127.0.0.1:52140');
            } else if (error.message.includes('Failed to fetch')) {
                throw new Error('Error de conexión: DICloak no responde. Verifica que esté ejecutándose y accesible');
            } else if (error.message.includes('NetworkError')) {
                throw new Error('Error de red: Problema de conectividad con DICloak');
            } else if (error.message.includes('CORS')) {
                throw new Error('Error de CORS: DICloak necesita configuración adicional para permitir conexiones web');
            } else {
                throw error;
            }
        }
    }

    async testConnection() {
        try {
            console.log('🔍 === INICIANDO TEST DE CONEXIÓN ===');
            console.log(`🌐 URL base: ${this.baseUrl}`);
            console.log(`🔑 API Key configurada: ${this.apiKey ? '✅ Sí' : '❌ No'}`);
            
            const testEndpoints = [
                '/v1/env/list',
                '/v1/members?page=1&size=1',
                '/v1/member/roles'
            ];
            
            let successCount = 0;
            
            for (const endpoint of testEndpoints) {
                try {
                    console.log(`🧪 Probando endpoint: ${endpoint}`);
                    await this.makeRequest(endpoint, 'GET');
                    successCount++;
                    console.log(`✅ Endpoint ${endpoint}: OK`);
                } catch (error) {
                    console.error(`❌ Endpoint ${endpoint}: ${error.message}`);
                }
            }
            
            console.log(`📊 Resumen: ${successCount}/${testEndpoints.length} endpoints funcionando`);
            return successCount > 0;
            
        } catch (error) {
            console.error('❌ Error crítico en test de conexión:', error);
            return false;
        }
    }

    async getMemberList(page = 1, size = 100) {
        return await this.makeRequest(`/v1/members?page=${page}&size=${size}&detail=true`, 'GET');
    }

    async getAllMembers() {
        console.log('🔄 === INICIANDO CARGA COMPLETA DE MIEMBROS ===');
        
        try {
            // Método 1: Intentar cargar todos con all=true
            try {
                const allMembersResult = await this.makeRequest(`/v1/members?all=true&detail=true`, 'GET');
                const allMembers = allMembersResult.data?.list || [];
                
                if (allMembers.length > 0) {
                    console.log(`🎯 ¡ÉXITO! Cargados ${allMembers.length} miembros usando all=true`);
                    return allMembers;
                }
            } catch (allError) {
                console.warn(`⚠️ Método all=true falló: ${allError.message}`);
            }

            // Método 2: Fallback con paginación
            const totalCheck = await this.makeRequest(`/v1/members?page=1&size=1&detail=true`, 'GET');
            const totalMembers = totalCheck.data?.total || 0;
            
            console.log(`📈 Total de miembros detectado: ${totalMembers}`);
            
            if (totalMembers === 0) {
                console.log('⚠️ No hay miembros en el sistema');
                return [];
            }

            // Intentar cargar en una sola página grande
            const largeSizes = [totalMembers, Math.min(totalMembers, 1000), Math.min(totalMembers, 500)];
            
            for (const size of largeSizes) {
                try {
                    console.log(`📦 Intentando cargar ${totalMembers} miembros en una página de ${size}...`);
                    const result = await this.makeRequest(`/v1/members?page=1&size=${size}&detail=true`, 'GET');
                    const pageMembers = result.data?.list || [];
                    
                    if (pageMembers.length >= totalMembers * 0.9) {
                        console.log(`🎯 ¡ÉXITO! Cargados ${pageMembers.length} miembros en una sola página`);
                        return pageMembers;
                    }
                } catch (largePageError) {
                    console.warn(`⚠️ Página grande de ${size} falló: ${largePageError.message}`);
                    continue;
                }
            }

            // Método 3: Paginación tradicional
            console.log('📦 Método 3: Paginación tradicional...');
            return await this.getAllMembersPaginated(totalMembers);
            
        } catch (error) {
            console.error('❌ Error crítico en getAllMembers:', error);
            throw new Error(`Error al cargar miembros: ${error.message}`);
        }
    }

    async getAllMembersPaginated(totalMembers) {
        let allMembers = [];
        const maxPageSize = 100;
        const totalPages = Math.ceil(totalMembers / maxPageSize);
        
        for (let page = 1; page <= totalPages; page++) {
            try {
                const result = await this.makeRequest(`/v1/members?page=${page}&size=${maxPageSize}&detail=true`, 'GET');
                const pageMembers = result.data?.list || [];
                
                if (pageMembers.length === 0) break;
                
                allMembers = allMembers.concat(pageMembers);
                
                if (allMembers.length >= totalMembers) break;
                if (pageMembers.length < maxPageSize) break;
                
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (pageError) {
                console.error(`❌ Error página ${page}:`, pageError);
                if (page <= 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    page--;
                    continue;
                }
            }
        }
        
        return allMembers;
    }

    async getMemberDetails(memberId) {
        try {
            console.log(`🔍 Obteniendo detalles del miembro ${memberId}...`);
            const result = await this.makeRequest(`/v1/member/${memberId}`, 'GET');
            
            if (!result.data) {
                throw new Error(`Miembro con ID ${memberId} no encontrado`);
            }
            
            return result;
        } catch (error) {
            if (error.message.includes('HTTP 404') || error.message.includes('Data does not exist')) {
                throw new Error(`El miembro con ID ${memberId} no existe o fue eliminado`);
            }
            throw error;
        }
    }

    // ALTERNATIVA 1: Validación previa de IDs de grupos CON team_id
    async validateGroupIds(groupIds) {
        console.log('🔍 === VALIDANDO IDS DE GRUPOS CON TEAM_ID ===');
        
        // Asegurar que tenemos team_id
        const teamId = await this.getTeamId();
        if (!teamId) {
            console.warn('⚠️ No se pudo obtener team_id, intentando sin él...');
        }

        const validIds = [];
        const invalidIds = [];
        
        for (const groupId of groupIds) {
            try {
                console.log(`🧪 Validando grupo ID: ${groupId} ${teamId ? `con team_id: ${teamId}` : 'sin team_id'}`);
                
                // Intentar diferentes formatos de endpoint
                const endpoints = [
                    `/v1/env/group/${groupId}`,
                    teamId ? `/v1/env/group/${groupId}?team_id=${teamId}` : null,
                    teamId ? `/v1/team/${teamId}/env/group/${groupId}` : null
                ].filter(Boolean);

                let groupFound = false;
                for (const endpoint of endpoints) {
                    try {
                        const result = await this.makeRequest(endpoint, 'GET');
                        if (result.data) {
                            validIds.push(groupId);
                            console.log(`✅ Grupo ${groupId} es válido: ${result.data.name} (endpoint: ${endpoint})`);
                            groupFound = true;
                            break;
                        }
                    } catch (endpointError) {
                        console.log(`❌ Endpoint ${endpoint} falló: ${endpointError.message}`);
                    }
                }

                if (!groupFound) {
                    invalidIds.push(groupId);
                    console.log(`❌ Grupo ${groupId} no es válido en ningún endpoint`);
                }
                
            } catch (error) {
                invalidIds.push(groupId);
                console.log(`❌ Grupo ${groupId} es inválido: ${error.message}`);
            }
        }
        
        console.log(`📊 Resumen validación: ${validIds.length} válidos, ${invalidIds.length} inválidos`);
        return { validIds, invalidIds };
    }

    // ALTERNATIVA 2: Buscar endpoint correcto para listar grupos CON team_id
    async findWorkingGroupsEndpoint() {
        const teamId = await this.getTeamId();
        
        const endpoints = [
            // Endpoints estándar para grupos
            { url: '/v1/env/group', method: 'GET' },
            { url: '/v1/env/groups', method: 'GET' },
            { url: '/v1/groups', method: 'GET' },
            { url: '/v1/profile/groups', method: 'GET' },
            { url: '/v1/environment/groups', method: 'GET' },
            
            // Endpoints con team_id si está disponible
            ...(teamId ? [
                { url: `/v1/team/${teamId}/env/groups`, method: 'GET' },
                { url: `/v1/env/group?team_id=${teamId}`, method: 'GET' },
                { url: `/v1/groups?team_id=${teamId}`, method: 'GET' }
            ] : []),
            
            // Endpoints alternativos que pueden devolver información de grupos
            { url: '/v1/env/list', method: 'GET' },
            { url: '/v1/profiles', method: 'GET' },
            { url: '/v1/member/groups', method: 'GET' },
            
            // Endpoints con parámetros
            { url: '/v1/env/group?page=1&size=100', method: 'GET' },
            { url: '/v1/groups?all=true', method: 'GET' }
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Probando endpoint: ${endpoint.url} ${teamId ? `(team_id: ${teamId})` : ''}`);
                const result = await this.makeRequest(endpoint.url, endpoint.method);
                
                // Buscar estructura de grupos en diferentes ubicaciones
                const groupLocations = [
                    result.data?.list,
                    result.data?.groups,
                    result.data?.env_groups,
                    result.data?.data?.list,
                    result.data
                ];
                
                for (const location of groupLocations) {
                    if (Array.isArray(location) && location.length > 0) {
                        const sample = location[0];
                        if (sample.id || sample.group_id) {
                            console.log(`✅ Endpoint funcional encontrado: ${endpoint.url}`);
                            console.log(`📋 Estructura de grupo:`, sample);
                            return { endpoint: endpoint.url, data: location, teamId };
                        }
                    }
                }
                
            } catch (error) {
                console.log(`❌ Endpoint ${endpoint.url} falló: ${error.message}`);
            }
        }
        
        return null;
    }

    // ALTERNATIVA 4: Estrategia de asignación múltiple CON team_id
    async assignSpecificGroups(memberId, groupIds) {
        console.log(`🎯 === ESTRATEGIA MÚLTIPLE PARA GRUPOS ESPECÍFICOS CON TEAM_ID ===`);
        console.log(`🆔 Miembro: ${memberId}`);
        console.log(`📋 Grupos solicitados: ${groupIds}`);
        
        // Obtener team_id
        const teamId = await this.getTeamId();
        console.log(`🏢 Team ID: ${teamId || 'No disponible'}`);
        
        // Paso 1: Validar IDs (ahora incluye validación con team_id)
        const validation = await this.validateGroupIds(groupIds);
        
        if (validation.validIds.length === 0) {
            console.error('❌ Ningún ID de grupo es válido');
            return { 
                success: false, 
                message: `IDs de grupos inválidos: ${validation.invalidIds.join(', ')}`,
                details: validation
            };
        }
        
        if (validation.invalidIds.length > 0) {
            console.warn(`⚠️ Algunos IDs son inválidos: ${validation.invalidIds.join(', ')}`);
        }
        
        console.log(`✅ Usando IDs válidos: ${validation.validIds.join(', ')}`);
        
        // Estrategia A: Método estándar CON team_id en datos
        try {
            console.log(`🚀 Estrategia A: Método estándar con team_id...`);
            const currentResult = await this.getMemberDetails(memberId);
            const current = currentResult.data;
            
            const updateData = {
                name: current.name,
                authority: current.authority,
                role_id: current.role_id,
                type: current.type,
                all_env_group: false,
                env_group_ids: validation.validIds
            };

            // Agregar team_id si está disponible
            if (teamId) {
                updateData.team_id = teamId;
                console.log(`✅ Incluyendo team_id en datos: ${teamId}`);
            }
            
            // Preservar datos existentes
            if (current.email) updateData.email = current.email;
            if (current.username) updateData.username = current.username;
            if (current.phone) updateData.phone = current.phone;
            if (current.status) updateData.status = current.status;
            if (current.remark) updateData.remark = current.remark;
            
            await this.makeRequest(`/v1/member/${memberId}`, 'PATCH', updateData);
            
            // Verificar resultado
            await new Promise(resolve => setTimeout(resolve, 500));
            const checkResult = await this.getMemberDetails(memberId);
            const updatedGroups = checkResult.data?.env_group_list || [];
            
            if (updatedGroups.length > 0) {
                console.log(`✅ Estrategia A exitosa: ${updatedGroups.length} grupos aplicados`);
                return { 
                    success: true, 
                    message: `${updatedGroups.length} grupos aplicados correctamente`,
                    appliedGroups: updatedGroups,
                    method: 'Método estándar con team_id'
                };
            }
            
        } catch (standardError) {
            console.warn(`❌ Estrategia A falló: ${standardError.message}`);
        }
        
        // Estrategia B: Asignación directa por grupos CON team_id
        try {
            console.log(`🚀 Estrategia B: Asignación directa por grupos con team_id...`);
            const results = [];
            
            for (const groupId of validation.validIds) {
                try {
                    // Intentar obtener grupo con diferentes endpoints
                    const groupEndpoints = [
                        `/v1/env/group/${groupId}`,
                        teamId ? `/v1/env/group/${groupId}?team_id=${teamId}` : null,
                        teamId ? `/v1/team/${teamId}/env/group/${groupId}` : null
                    ].filter(Boolean);

                    let group = null;
                    let workingEndpoint = null;

                    for (const endpoint of groupEndpoints) {
                        try {
                            const groupResult = await this.makeRequest(endpoint, 'GET');
                            if (groupResult.data) {
                                group = groupResult.data;
                                workingEndpoint = endpoint;
                                break;
                            }
                        } catch (endpointError) {
                            console.log(`❌ Endpoint ${endpoint} falló: ${endpointError.message}`);
                        }
                    }
                    
                    if (group && workingEndpoint) {
                        console.log(`📋 Grupo encontrado: ${group.name} (endpoint: ${workingEndpoint})`);
                        console.log(`👥 Miembros actuales:`, group.member_list?.map(m => m.member_id) || []);
                        
                        // Obtener miembros actuales del grupo
                        const currentMembers = group.member_list || [];
                        const memberIds = currentMembers.map(m => m.member_id || m.id);
                        
                        // Agregar nuestro miembro si no está
                        if (!memberIds.includes(memberId)) {
                            memberIds.push(memberId);
                            
                            const updateGroupData = {
                                name: group.name,
                                member_ids: memberIds,
                                remark: group.remark || ''
                            };

                            // Agregar team_id si está disponible
                            if (teamId) {
                                updateGroupData.team_id = teamId;
                            }
                            
                            // Intentar actualizar con el endpoint que funcionó
                            const updateEndpoint = workingEndpoint.replace('/GET', '');
                            await this.makeRequest(updateEndpoint, 'PUT', updateGroupData);
                            results.push(`Grupo ${groupId} actualizado`);
                            console.log(`✅ Miembro agregado al grupo ${groupId}`);
                        }
                    }
                } catch (groupError) {
                    console.warn(`❌ Error con grupo ${groupId}: ${groupError.message}`);
                }
            }
            
            if (results.length > 0) {
                return { 
                    success: true, 
                    message: `Miembro agregado a ${results.length} grupos`,
                    method: 'Asignación directa por grupos con team_id',
                    details: results
                };
            }
            
        } catch (directError) {
            console.warn(`❌ Estrategia B falló: ${directError.message}`);
        }
        
        // Estrategia C: Método de transición CON team_id
        try {
            console.log(`🚀 Estrategia C: Método de transición con team_id...`);
            const currentResult = await this.getMemberDetails(memberId);
            const current = currentResult.data;
            
            // Paso 1: Establecer all_env_group = true
            const allGroupsData = {
                name: current.name,
                authority: current.authority,
                role_id: current.role_id,
                type: current.type,
                all_env_group: true
            };

            // Agregar team_id si está disponible
            if (teamId) {
                allGroupsData.team_id = teamId;
            }
            
            if (current.email) allGroupsData.email = current.email;
            if (current.username) allGroupsData.username = current.username;
            if (current.phone) allGroupsData.phone = current.phone;
            if (current.status) allGroupsData.status = current.status;
            if (current.remark) allGroupsData.remark = current.remark;
            
            await this.makeRequest(`/v1/member/${memberId}`, 'PATCH', allGroupsData);
            console.log(`✅ Paso 1 completado: all_env_group = true con team_id`);
            
            // Esperar un poco
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Paso 2: Cambiar a grupos específicos
            const specificGroupsData = {
                ...allGroupsData,
                all_env_group: false,
                env_group_ids: validation.validIds
            };
            
            await this.makeRequest(`/v1/member/${memberId}`, 'PATCH', specificGroupsData);
            console.log(`✅ Paso 2 completado: grupos específicos con team_id`);
            
            // Verificar resultado final
            await new Promise(resolve => setTimeout(resolve, 500));
            const finalResult = await this.getMemberDetails(memberId);
            const finalGroups = finalResult.data?.env_group_list || [];
            
            if (finalGroups.length > 0) {
                return { 
                    success: true, 
                    message: `${finalGroups.length} grupos aplicados mediante transición con team_id`,
                    method: 'Método de transición con team_id',
                    appliedGroups: finalGroups
                };
            }
            
        } catch (transitionError) {
            console.warn(`❌ Estrategia C falló: ${transitionError.message}`);
        }
        
        // Si todas las estrategias fallan
        return { 
            success: false, 
            message: 'Todas las estrategias de asignación fallaron (incluyendo con team_id)',
            validIds: validation.validIds,
            invalidIds: validation.invalidIds,
            teamId: teamId,
            suggestions: [
                'Verifica que los IDs de grupos sean correctos',
                'Confirma que el API Key tenga permisos para modificar grupos',
                `${teamId ? `Team ID detectado: ${teamId}` : 'No se pudo detectar team_id - esto puede ser el problema'}`,
                'Puede ser una limitación de la versión actual de DICloak',
                'Considera usar "Acceso a todos los grupos" como alternativa'
            ]
        };
    }

    // MÉTODO ACTUALIZADO: Obtener grupos usando la API oficial
    async getEnvironmentGroups() {
        console.log('🔍 === OBTENIENDO GRUPOS CON API OFICIAL ===');
        
        try {
            // Obtener team_id si está disponible
            const teamId = await this.getTeamId();
            console.log(`🏢 Team ID para grupos: ${teamId || 'No disponible'}`);
            
            // Usar la API oficial: GET /v1/env/group
            const params = new URLSearchParams({
                all: 'true',
                detail: 'true'
            });
            
            console.log(`🔍 Usando endpoint oficial: /v1/env/group?${params}`);
            const result = await this.makeRequest(`/v1/env/group?${params}`, 'GET');
            
            if (result.data && result.data.list && Array.isArray(result.data.list)) {
                console.log(`✅ Grupos obtenidos: ${result.data.list.length}`);
                console.log('📋 Estructura de grupos:', result.data.list[0]);
                return result;
            } else {
                console.warn('⚠️ Respuesta sin grupos válidos');
                return { data: { list: [] } };
            }
            
        } catch (error) {
            console.error('❌ Error en API oficial de grupos:', error);
            
            // Fallback: intentar sin parámetros
            try {
                console.log('🔄 Intentando fallback sin parámetros...');
                const fallbackResult = await this.makeRequest('/v1/env/group', 'GET');
                if (fallbackResult.data?.list) {
                    return fallbackResult;
                }
            } catch (fallbackError) {
                console.error('❌ Fallback también falló:', fallbackError);
            }
            
            // Último recurso: devolver lista vacía
            return { data: { list: [] } };
        }
    }

    // MÉTODO NUEVO: Obtener detalles específicos de un grupo
    async getGroupDetails(groupId) {
        try {
            console.log(`🔍 Obteniendo detalles del grupo ${groupId}...`);
            const teamId = await this.getTeamId(); // Get team_id

            let result;
            let lastError;

            if (teamId) {
                try {
                    console.log(`🧪 Intentando obtener grupo ${groupId} con team_id ${teamId}`);
                    result = await this.makeRequest(`/v1/env/group/${groupId}?team_id=${teamId}`, 'GET');
                    if (result.data) {
                        console.log(`✅ Grupo ${groupId} encontrado con team_id:`, result.data);
                        return result;
                    }
                } catch (e) {
                    console.warn(`⚠️ Falló obtener grupo ${groupId} con team_id ${teamId}: ${e.message}`);
                    lastError = e; // Store error to rethrow if fallback also fails
                }
            }

            // Fallback: try without team_id in query param or if team_id attempt failed
            console.log(`🧪 Intentando obtener grupo ${groupId} sin team_id explícito en query param`);
            result = await this.makeRequest(`/v1/env/group/${groupId}`, 'GET');
            
            if (result.data) {
                console.log(`✅ Grupo ${groupId} encontrado (sin team_id explícito en query param):`, result.data);
                return result;
            } else {
                // If we are here, both attempts (if teamId was present) or the single attempt failed
                if (lastError) throw lastError; // Rethrow error from team_id attempt if it happened
                throw new Error(`Grupo ${groupId} no encontrado`);
            }
        } catch (error) {
            console.error(`❌ Error obteniendo grupo ${groupId}:`, error);
            throw error;
        }
    }

    // MÉTODO NUEVO: Actualizar grupo usando API oficial
    async updateGroup(groupId, groupData) {
        try {
            console.log(`🚀 Actualizando grupo ${groupId}...`);
            const result = await this.makeRequest(`/v1/env/group/${groupId}`, 'PUT', groupData);
            
            if (!result.data) {
                throw new Error(`Grupo con ID ${groupId} no encontrado`);
            }
            
            return result;
        } catch (error) {
            console.error(`❌ Error actualizando grupo ${groupId}:`, error);
            throw error;
        }
    }

    // MÉTODO CORREGIDO: Asignación de grupos específicos usando API oficial
    async assignSpecificGroupsOfficial(memberId, groupIds) {
        console.log(`🎯 === ASIGNACIÓN DE GRUPOS ESPECÍFICOS CON API OFICIAL ===`);
        console.log(`🆔 Miembro: ${memberId}`);
        console.log(`📋 Grupos a asignar: ${groupIds}`);
        
        // Obtener team_id
        const teamId = await this.getTeamId();
        console.log(`🏢 Team ID: ${teamId || 'No disponible'}`);
        
        // Validar IDs de grupos
        const validation = await this.validateGroupIds(groupIds);
        if (validation.invalidIds.length > 0) {
            console.warn(`⚠️ Algunos IDs de grupo son inválidos: ${validation.invalidIds.join(', ')}`);
        }
        
        const validIds = validation.validIds;
        
        // Estrategia A: Asignación estándar con API oficial
        try {
            console.log(`🚀 Estrategia A: Asignación estándar...`);
            const currentResult = await this.getMemberDetails(memberId);
            const current = currentResult.data;
            
            // Paso 1: Actualizar datos básicos del miembro (sin grupos aún)
            const baseUpdateData = {
                name: current.name,
                authority: current.authority,
                role_id: current.role_id, // Ensure this is the correct role_id from current details
                type: current.type,
                all_env_group: false, // This is key for specific group assignment logic by API
                remark: current.remark,
                // Ensure all potentially required fields are included from current member details
                email: current.email,
                username: current.username,
                phone: current.phone,
                status: current.status
            };

            // Agregar team_id si está disponible
            if (teamId) {
                baseUpdateData.team_id = teamId;
                console.log(`✅ Incluyendo team_id en datos base: ${teamId}`);
            }
            
            console.log(`📤 Datos para actualizar miembro en assignSpecificGroupsOfficial (Paso 1):`, JSON.stringify(baseUpdateData, null, 2));
            await this.makeRequest(`/v1/member/${memberId}`, 'PUT', baseUpdateData);
            console.log(`✅ Datos básicos del miembro actualizados (dentro de assignSpecificGroupsOfficial)`);
            
            // Paso 2: Asignar grupos específicos
            if (validIds.length > 0) {
                const groupData = {
                    member_ids: [memberId],
                    env_group_ids: validIds,
                    all_env_group: false
                };
                
                // Intentar con diferentes métodos de actualización de grupos
                const groupUpdateMethods = [
                    { method: 'PUT', description: 'Método estándar (PUT)' },
                    { method: 'PATCH', description: 'Método alternativo (PATCH)' }
                ];
                
                for (const { method, description } of groupUpdateMethods) {
                    try {
                        console.log(`🔄 Intentando ${description} para asignar grupos...`);
                        await this.updateGroup(validIds[0], groupData); // Usar el primer ID de grupo para la actualización
                        console.log(`✅ Grupos asignados correctamente usando ${description}`);
                        return { success: true, message: `Grupos asignados correctamente (${description})` };
                    } catch (updateError) {
                        console.warn(`⚠️ Fallo al usar ${description}: ${updateError.message}`);
                    }
                }
                
                throw new Error('No se pudo asignar grupos usando los métodos disponibles');
            } else {
                console.log(`⚠️ No hay IDs de grupo válidos para asignar`);
            }
            
        } catch (error) {
            console.error('❌ Error en asignación de grupos:', error);
            throw error;
        }
    }

    // MÉTODO ACTUALIZADO: updateMemberStrict con API oficial de grupos
    async updateMemberStrict(memberId, memberData) {
        try {
            console.log(`🚀 === ACTUALIZACIÓN CON API OFICIAL DE GRUPOS (USING PUT) ===`);
            console.log(`🆔 Miembro ID: ${memberId}`);
            console.log(`📋 Datos recibidos para updateMemberStrict:`, JSON.stringify(memberData, null, 2));
            
            const teamId = await this.getTeamId();
            console.log(`🏢 Team ID detectado: ${teamId || 'No disponible'}`);
            
            if (!memberId) throw new Error('ID de miembro es requerido');
            if (!memberData.name || !memberData.authority || !memberData.type || !memberData.email) {
                // Added email and type to required fields check based on typical API requirements for PUT
                console.error('Campos obligatorios faltantes. Recibido:', memberData);
                throw new Error('Campos obligatorios faltantes: name, email, authority, type');
            }
            
            let roleId = memberData.role_id;
            if (!roleId || roleId === null) {
                console.warn(`⚠️ role_id es null o no provisto, intentando obtener roles disponibles...`);
                try {
                    const rolesResult = await this.getMemberRoles();
                    const roles = rolesResult.data?.list || [];
                    if (roles.length > 0) {
                        roleId = roles[0].id; // Use the ID of the first role as a fallback
                        console.log(`✅ Usando rol por defecto: ${roleId} (${roles[0].name})`);
                    } else {
                        console.error('❌ No hay roles disponibles y role_id no fue provisto.');
                        throw new Error('role_id es requerido y no hay roles disponibles para usar como fallback.');
                    }
                } catch (roleError) {
                    console.error('❌ Error obteniendo roles para fallback:', roleError);
                    throw new Error('role_id es requerido, y ocurrió un error al intentar obtener roles de fallback.');
                }
            }

            const updatePayload = {
                name: String(memberData.name).trim(),
                email: String(memberData.email).trim(), // Ensure email is included
                authority: String(memberData.authority),
                type: String(memberData.type),
                role_id: String(roleId), // Ensure role_id is a string
                status: memberData.status ? String(memberData.status) : undefined, // Include if provided
                remark: memberData.remark ? String(memberData.remark) : undefined, // Include if provided
                all_env_group: typeof memberData.all_env_group === 'boolean' ? memberData.all_env_group : false, // Default to false if not boolean
                env_group_ids: [], // Initialize as empty array
                manager_id: memberData.manager_id ? String(memberData.manager_id) : undefined,
                agent_id: memberData.agent_id ? String(memberData.agent_id) : undefined,
            };

            if (teamId) {
                updatePayload.team_id = teamId;
                console.log(`✅ Incluyendo team_id en payload: ${teamId}`);
            }
            
            // Optional fields from memberData (like phone, username)
            if (memberData.phone) updatePayload.phone = String(memberData.phone);
            if (memberData.username) updatePayload.username = String(memberData.username);


            if (updatePayload.all_env_group === true) {
                updatePayload.env_group_ids = []; // API might expect empty array if all_env_group is true
                console.log(`✅ Configurado all_env_group: true, env_group_ids será vaciado.`);
            } else if (Array.isArray(memberData.env_group_ids) && memberData.env_group_ids.length > 0) {
                updatePayload.env_group_ids = memberData.env_group_ids.map(id => String(id)).filter(id => id && id.trim());
                console.log(`🎯 Configurado all_env_group: false. Grupos específicos solicitados: ${updatePayload.env_group_ids.join(', ')}`);
            } else {
                // all_env_group is false, but no specific groups provided.
                // API might require env_group_ids to be an empty array or might interpret its absence as "no change" or "no groups".
                // Sending an empty array is safer if specific groups are expected when all_env_group is false.
                updatePayload.env_group_ids = [];
                console.log(`⚠️ all_env_group es false pero no hay env_group_ids específicos. Se enviará env_group_ids vacío.`);
            }
            
            // Remove undefined fields from payload, as some APIs are strict
            Object.keys(updatePayload).forEach(key => {
                if (updatePayload[key] === undefined) {
                    delete updatePayload[key];
                }
            });

            console.log(`📤 Payload final para envío (PUT /v1/member/${memberId}):`, JSON.stringify(updatePayload, null, 2));

            const result = await this.makeRequest(`/v1/member/${memberId}`, 'PUT', updatePayload);
            console.log(`✅ Miembro ${memberId} actualizado exitosamente con la nueva estructura de payload.`);
            
            return result;
            
        } catch (error) {
            console.error(`❌ Error en updateMemberStrict:`, error);
            
            if (error.message.includes('HTTP 400')) {
                throw new Error(`Datos inválidos para la actualización: ${error.message}`);
            } else if (error.message.includes('HTTP 404')) {
                throw new Error(`Miembro ${memberId} no encontrado.`);
            } else if (error.message.includes('HTTP 403')) {
                throw new Error(`Sin permisos para actualizar miembro ${memberId}.`);
            } else {
                throw error;
            }
        }
    }

    async getMemberRoles() {
        return await this.makeRequest('/v1/member/roles', 'GET');
    }

    async createMember(memberData) {
        console.log(`🚀 Creando nuevo miembro...`);
        // Ensure 'type' is set, defaulting to INTERNAL if not explicitly provided
        const payload = { ...memberData, type: memberData.type || "INTERNAL" };
        console.log(`📤 Payload para crear miembro:`, JSON.stringify(payload, null, 2));
        return await this.makeRequest('/v1/member', 'POST', payload);
    }

    async deleteMember(memberId) {
        try {
            console.log(`🗑️ Eliminando miembro ${memberId}...`);
            // The X-API-KEY is automatically added by makeRequest
            const result = await this.makeRequest(`/v1/member/${memberId}`, 'DELETE');
            console.log(`✅ Miembro ${memberId} eliminado exitosamente.`);
            return result;
        } catch (error) {
            console.error(`❌ Error eliminando miembro ${memberId}:`, error);
            if (error.message.includes('HTTP 404')) {
                throw new Error(`Miembro ${memberId} no encontrado o ya fue eliminado.`);
            } else if (error.message.includes('HTTP 403')) {
                throw new Error(`Sin permisos para eliminar miembro ${memberId}.`);
            }
            throw error;
        }
    }
}

class App {
    constructor() {
        this.api = new DICloakAPI();
        this.allMembers = [];
        this.filteredMembers = [];
        this.currentPage = 1;
        this.membersPerPage = 10;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadApiKey();
        // Load roles and groups on init for both forms
        this.loadMemberRoles(); // This populates both #edit-member-role and #create-member-role
        this.loadEnvironmentGroups(); // This populates both #edit-env-groups-container and #create-env-groups-container
    }

    bindEvents() {
        document.getElementById('test-connection')?.addEventListener('click', () => this.testConnection());
        document.getElementById('api-key')?.addEventListener('input', (e) => this.updateApiKey(e.target.value));
        document.getElementById('load-members')?.addEventListener('click', () => this.loadMembers());
        document.getElementById('edit-member-form')?.addEventListener('submit', (e) => this.handleEditMember(e));
        document.getElementById('load-member-data')?.addEventListener('click', () => this.loadMemberData());
        document.getElementById('search-members')?.addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('filter-type')?.addEventListener('change', () => this.handleFilter());
        document.getElementById('filter-status')?.addEventListener('change', () => this.handleFilter());
        document.getElementById('test-api-responses')?.addEventListener('click', () => this.testAPIResponses());
        document.getElementById('load-test-user')?.addEventListener('click', () => this.loadTestUser());
        document.getElementById('execute-edit-test')?.addEventListener('click', () => this.executeDetailedEditTest());
        document.getElementById('advanced-diagnostic')?.addEventListener('click', () => this.runAdvancedDiagnostic());
        document.getElementById('repair-groups')?.addEventListener('click', () => this.testGroupRepair());
        // Event listener for the new create form
        document.getElementById('create-member-form')?.addEventListener('submit', (e) => this.handleCreateMember(e));
        // Bind reset button for create form if one exists with a specific ID or class
        // Assuming a button like: <button type="button" onclick="app.resetCreateForm()" class="btn-secondary">🗑️ Limpiar Formulario</button>
        // If the button is already in HTML with onclick="app.resetCreateForm()", this explicit binding isn't strictly needed here
        // but it's good practice if we were to add an ID to it.
    }

    loadApiKey() {
        const savedApiKey = localStorage.getItem('dicloak-api-key');
        if (savedApiKey) {
            document.getElementById('api-key').value = savedApiKey;
            this.updateApiKey(savedApiKey);
        }
    }

    updateApiKey(apiKey) {
        this.api.setApiKey(apiKey);
        if (apiKey) {
            localStorage.setItem('dicloak-api-key', apiKey);
        } else {
            localStorage.removeItem('dicloak-api-key');
        }
    }

    showMessage(message, type = 'info') {
        const messageElement = document.getElementById('message');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.className = `message ${type}`;
            messageElement.style.display = 'block';
            
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 5000);
        }
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
    }

    async testConnection() {
        const apiKey = document.getElementById('api-key').value;
        if (!apiKey) {
            this.showMessage('Por favor ingresa tu API Key', 'error');
            return;
        }

        try {
            this.showMessage('🔄 Ejecutando diagnóstico completo de conexión...', 'info');
            console.log('🔍 === DIAGNÓSTICO COMPLETO DE CONEXIÓN ===');
            
            console.log(`🌐 URL objetivo: ${this.api.baseUrl}`);
            console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
            
            const isConnected = await this.api.testConnection();
            
            if (isConnected) {
                this.showMessage('✅ Conexión exitosa con DICloak', 'success');
                console.log('✅ Conexión establecida correctamente');
                
                try {
                    console.log('🔄 Cargando configuraciones adicionales...');
                    
                    // Obtener team_id automáticamente
                    const teamId = await this.api.getTeamId();
                    if (teamId) {
                        console.log(`🏢 Team ID detectado: ${teamId}`);
                        this.showMessage(`✅ Conexión exitosa - Team ID: ${teamId}`, 'success');
                    } else {
                        console.warn('⚠️ No se pudo detectar team_id');
                        this.showMessage('✅ Conexión exitosa, pero no se detectó team_id', 'success');
                    }
                    
                    await this.loadMemberRoles();
                    await this.loadEnvironmentGroups();
                    console.log('✅ Roles y grupos cargados correctamente');
                } catch (roleError) {
                    console.warn('⚠️ No se pudieron cargar algunos datos adicionales:', roleError.message);
                    this.showMessage('✅ Conexión exitosa, pero algunos datos adicionales no están disponibles', 'success');
                }
            } else {
                this.showMessage('❌ No se pudo conectar con DICloak', 'error');
                console.error('❌ Fallo en la conexión con DICloak');
                await this.performConnectionDiagnostic();
            }
        } catch (error) {
            console.error('❌ Error crítico en testConnection:', error);
            
            let errorMessage = '❌ Error de conexión: ';
            
            if (error.message.includes('Failed to fetch') || error.message.includes('fetch failed')) {
                errorMessage += 'DICloak no está accesible. Verifica que esté ejecutándose en el puerto 52140';
            } else if (error.message.includes('NetworkError')) {
                errorMessage += 'Error de red. Verifica tu conexión y que DICloak esté ejecutándose';
            } else if (error.message.includes('CORS')) {
                errorMessage += 'Error de CORS. DICloak puede necesitar configuración adicional';
            } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
                errorMessage += 'API Key inválida. Verifica tu clave de API';
            } else if (error.message.includes('HTTP 404')) {
                errorMessage += 'Endpoint no encontrado. Verifica la versión de DICloak';
            } else if (error.message.includes('HTTP 500')) {
                errorMessage += 'Error interno del servidor DICloak';
            } else {
                errorMessage += error.message;
            }
            
            this.showMessage(errorMessage, 'error');
        }
    }

    async performConnectionDiagnostic() {
        console.log('🔍 === INICIANDO DIAGNÓSTICO AVANZADO ===');
        
        try {
            console.log('🧪 Test 1: Verificando accesibilidad del puerto 52140...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('http://127.0.0.1:52140/', { 
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            console.log(`📡 Puerto 52140 responde: ${response.status}`);
        } catch (portError) {
            console.error('❌ Puerto 52140 no accesible:', portError.message);
            console.log('💡 Solución sugerida: Inicia DICloak y verifica que use el puerto 52140');
        }
        
        // Test 2: Verificar conectividad localhost
        try {
            console.log('🧪 Test 2: Verificando conectividad localhost...');
            const response = await fetch('http://localhost:52140/', {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            console.log(`📡 Localhost responde: ${response.status}`);
        } catch (localhostError) {
            console.error('❌ Localhost no accesible:', localhostError.message);
        }
        
        // Test 3: Verificar endpoint específico sin autenticación
        try {
            console.log('🧪 Test 3: Probando endpoint sin autenticación...');
            const response = await fetch('http://127.0.0.1:52140/openapi/v1/env/list', {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            console.log(`📡 Endpoint base responde: ${response.status}`);
            
            if (response.status === 401) {
                console.log('✅ DICloak está ejecutándose (requiere autenticación)');
                console.log('💡 El problema puede ser la API Key');
            }
        } catch (endpointError) {
            console.error('❌ Endpoint base no accesible:', endpointError.message);
        }
        
        console.log('📋 === RESUMEN DEL DIAGNÓSTICO ===');
        console.log('1. Verifica que DICloak esté ejecutándose');
        console.log('2. Confirma que use el puerto 52140');
        console.log('3. Verifica que tu API Key sea correcta');
        console.log('4. Asegúrate de que no haya firewall bloqueando la conexión');
    }

    async loadMemberRoles() {
        try {
            const result = await this.api.getMemberRoles();
            const roles = result.data?.list || [];
            
            const editRoleSelect = document.getElementById('edit-member-role');
            const createRoleSelect = document.getElementById('create-member-role');

            const populateRoles = (selectElement) => {
                if (selectElement) {
                    selectElement.innerHTML = '<option value="">Seleccionar rol</option>';
                    roles.forEach(role => {
                        const option = document.createElement('option');
                        option.value = role.id;
                        option.textContent = `${role.name} (ID: ${role.id})`;
                        selectElement.appendChild(option);
                    });
                }
            };
            
            populateRoles(editRoleSelect);
            populateRoles(createRoleSelect);

            if (roles.length > 0) {
                console.log(`✅ ${roles.length} roles cargados en selects`);
            } else {
                console.warn('⚠️ No se encontraron roles para cargar.');
            }

        } catch (error) {
            console.warn('⚠️ No se pudieron cargar los roles:', error.message);
        }
    }

    async loadEnvironmentGroups() {
        try {
            console.log('🔍 === CARGANDO GRUPOS CON API OFICIAL (para ambas formas) ===');
            
            let groups = [];
            let successMethod = null;
            
            try {
                const result = await this.api.getEnvironmentGroups();
                if (result.data && result.data.list && Array.isArray(result.data.list) && result.data.list.length > 0) {
                    groups = result.data.list.map(g => ({
                        id: g.id,
                        name: g.name || `Grupo ${g.id}`,
                        remark: g.remark || 'Grupo de perfil oficial',
                        memberCount: g.member_list?.length || 0,
                        envCount: g.env_list?.length || 0,
                        isDefault: g.is_default || false
                    }));
                    successMethod = 'API oficial de grupos DICloak';
                    console.log(`✅ Grupos oficiales cargados: ${groups.length}`);
                }
            } catch (officialError) {
                console.log(`⚠️ API oficial no disponible: ${officialError.message}`);
            }
            
            if (groups.length === 0 && this.allMembers.length > 0) {
                groups = this.extractGroupsFromLoadedMembers();
                if (groups.length > 0) {
                    successMethod = 'Extracción desde miembros cargados';
                    console.log(`✅ Extraídos ${groups.length} grupos desde miembros`);
                }
            }
            
            if (groups.length === 0) {
                successMethod = 'Modo básico: Solo "Todos los grupos" disponible';
            }
            
            console.log(`📊 Resultado final: ${groups.length} grupos encontrados`);
            // Render for edit form
            this.renderGroupsInterface(groups, successMethod, 'edit-env-groups-container', 'all-env-groups');
            // Render for create form
            this.renderGroupsInterface(groups, successMethod, 'create-env-groups-container', 'create-all-env-groups');
            
        } catch (error) {
            console.warn('⚠️ Error en loadEnvironmentGroups (no crítico):', error);
            this.renderGroupsInterface([], 'Modo básico: Solo "Todos los grupos" disponible', 'edit-env-groups-container', 'all-env-groups');
            this.renderGroupsInterface([], 'Modo básico: Solo "Todos los grupos" disponible', 'create-env-groups-container', 'create-all-env-groups');
        }
    }

    extractGroupsFromLoadedMembers() {
        if (!this.allMembers || this.allMembers.length === 0) return [];
        
        let allGroupsMap = new Map();
        
        this.allMembers.forEach(member => {
            if (member.env_group_list && Array.isArray(member.env_group_list)) {
                member.env_group_list.forEach(envGroup => {
                    const groupId = envGroup.group_id || envGroup.id;
                    const groupName = envGroup.env_group_name || envGroup.name || `Grupo ${groupId}`;
                    
                    if (groupId && !allGroupsMap.has(groupId)) {
                        allGroupsMap.set(groupId, {
                            id: groupId,
                            name: groupName,
                            remark: 'Extraído de miembros existentes',
                            memberCount: 1
                        });
                    } else if (groupId && allGroupsMap.has(groupId)) {
                        const existing = allGroupsMap.get(groupId);
                        existing.memberCount = (existing.memberCount || 0) + 1;
                    }
                });
            }
        });
        
        return Array.from(allGroupsMap.values());
    }

    renderGroupsInterface(groups, successMethod, containerId, allGroupsCheckboxId) {
        const envGroupsContainer = document.getElementById(containerId);
        if (!envGroupsContainer) {
            console.error(`❌ Contenedor ${containerId} no encontrado`);
            return;
        }

        if (groups.length > 0) {
            envGroupsContainer.innerHTML = this.getSuccessGroupsHTML(groups, successMethod, allGroupsCheckboxId);
        } else {
            envGroupsContainer.innerHTML = this.getNoGroupsHTML(allGroupsCheckboxId);
        }

        this.setupAllGroupsCheckbox(allGroupsCheckboxId, containerId);
    }

    getSuccessGroupsHTML(groups, method, allGroupsCheckboxId) {
        return `
            <h4 style="margin-bottom: 15px; color: #2c3e50;">
                📁 Grupos de Perfil Disponibles 
                <span style="background: #27ae60; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7em; margin-left: 10px;">
                    ${groups.length} encontrados
                </span>
            </h4>
            
            <div style="background: #e8f5e8; padding: 10px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #27ae60;">
                <small style="color: #2d5a2d;">
                    ✅ <strong>Éxito:</strong> ${method}
                </small>
            </div>
            
            <div style="max-height: 250px; overflow-y: auto; border: 2px solid #ddd; padding: 15px; border-radius: 8px; background: #f8f9fa;">
                ${groups.map(group => `
                    <label style="display: flex; align-items: center; margin-bottom: 12px; font-weight: normal; cursor: pointer; padding: 8px; border-radius: 6px; transition: background 0.2s;" 
                           onmouseover="this.style.background='#e3f2fd'" 
                           onmouseout="this.style.background='transparent'">
                        <input type="checkbox" name="env_group_ids" value="${group.id}" 
                               style="margin-right: 12px; width: auto; transform: scale(1.2);">
                        <span style="flex: 1;">
                            <strong style="color: #2c3e50; font-size: 1em;">${group.name}</strong>
                            <div style="font-size: 0.8em; color: #3498db; margin-top: 2px;">ID: ${group.id}</div>
                            ${group.remark ? `<div style="font-size: 0.85em; color: #666; margin-top: 4px; font-style: italic;">${group.remark}</div>` : ''}
                            ${group.memberCount ? `<div style="font-size: 0.8em; color: #27ae60; margin-top: 2px;">👥 ${group.memberCount} miembros</div>` : ''}
                            ${group.envCount ? `<div style="font-size: 0.8em; color: #3498db; margin-top: 2px;">🌐 ${group.envCount} perfiles</div>` : ''}
                            ${group.isDefault ? `<div style="font-size: 0.8em; color: #f39c12; margin-top: 2px;">⭐ Grupo por defecto</div>` : ''}
                        </span>
                    </label>
                `).join('')}
            </div>
            
            ${this.getAllGroupsCheckboxHTML(allGroupsCheckboxId)}
        `;
    }

    getNoGroupsHTML(allGroupsCheckboxId) {
        return `
            <h4 style="margin-bottom: 10px; color: #2c3e50;">📁 Grupos de Perfil</h4>
            
            <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db; text-align: center;">
                <div style="font-size: 1.5em; margin-bottom: 10px;">ℹ️</div>
                <strong style="color: #2c3e50;">Modo Básico Activado</strong>
                <div style="margin-top: 8px; color: #2c3e50; font-size: 0.9em;">
                    Los grupos específicos no están disponibles a través de la API, pero puedes:
                    <ul style="text-align: left; margin-top: 8px; padding-left: 20px;">
                        <li>✅ Dar acceso completo a todos los grupos</li>
                        <li>🔧 Mantener la configuración actual del miembro</li>
                        <li>📝 La funcionalidad de edición sigue siendo completamente funcional</li>
                    </ul>
                </div>
            </div>
            
            ${this.getAllGroupsCheckboxHTML(allGroupsCheckboxId)}
        `;
    }

    getAllGroupsCheckboxHTML(checkboxId) {
        return `
            <div style="margin-top: 15px; padding: 12px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #3498db;">
                <label style="display: flex; align-items: center; font-weight: normal; cursor: pointer;">
                    <input type="checkbox" id="${checkboxId}" 
                           style="margin-right: 12px; width: auto; transform: scale(1.2);">
                    <span style="color: #1976d2; font-weight: bold; font-size: 1.1em;">
                        ✅ Acceso a TODOS los grupos de perfil
                    </span>
                </label>
                <small style="color: #555; display: block; margin-top: 8px; margin-left: 24px;">
                    Recomendado: El miembro tendrá acceso a todos los grupos existentes y futuros.
                </small>
            </div>
        `;
    }

    setupAllGroupsCheckbox(allGroupsCheckboxId, containerId) {
        const allGroupsCheckbox = document.getElementById(allGroupsCheckboxId);
        const container = document.getElementById(containerId);

        if (allGroupsCheckbox && container) {
            allGroupsCheckbox.addEventListener('change', (e) => {
                const allChecked = e.target.checked;
                const groupCheckboxes = container.querySelectorAll('input[name="env_group_ids"]');
                
                groupCheckboxes.forEach(checkbox => {
                    checkbox.disabled = allChecked;
                    if (allChecked) checkbox.checked = false;
                });
                
                console.log(allChecked ? 
                    `🔧 Configurado acceso a TODOS los grupos (para ${containerId})` : 
                    `🔧 Habilitada selección específica de grupos (para ${containerId})`
                );
            });
        } else {
            console.warn(`Checkbox ${allGroupsCheckboxId} o contenedor ${containerId} no encontrado para setup.`);
        }
    }

    resetEditForm() {
        document.getElementById('edit-member-form').reset();
        document.getElementById('edit-member-id').value = '';
        document.getElementById('form-fields').disabled = true;
        document.getElementById('update-member-btn').disabled = true;
        
        const allGroupsCheckbox = document.getElementById('all-env-groups');
        const groupCheckboxes = document.querySelectorAll('#edit-env-groups-container input[name="env_group_ids"]');
        
        if (allGroupsCheckbox) allGroupsCheckbox.checked = false;
        groupCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
            checkbox.disabled = false;
        });
        
        // Set default for status if needed, e.g., to ENABLED
        const statusSelect = document.getElementById('edit-status');
        if (statusSelect) statusSelect.value = 'ENABLED'; // Default to ENABLED or "" for "keep current"

        this.showMessage('🗑️ Formulario limpiado', 'info');
    }

    resetCreateForm() {
        const form = document.getElementById('create-member-form');
        if (form) {
            form.reset();
        }

        const allGroupsCheckbox = document.getElementById('create-all-env-groups');
        const groupCheckboxes = document.querySelectorAll('#create-env-groups-container input[name="env_group_ids"]');

        if (allGroupsCheckbox) {
            allGroupsCheckbox.checked = false;
            // Trigger change event to re-enable specific group checkboxes
            const changeEvent = new Event('change', { bubbles: true });
            allGroupsCheckbox.dispatchEvent(changeEvent);
        }
        groupCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
            checkbox.disabled = false; // Ensure they are enabled
        });
        
        // Set default for status if needed, e.g., to ENABLED
        const statusSelect = document.getElementById('create-status');
        if (statusSelect) statusSelect.value = 'ENABLED'; // Default to ENABLED

        this.showMessage('🗑️ Formulario de creación limpiado', 'info');
    }

    async loadMembers() {
        try {
            this.showMessage('🔄 Cargando miembros...', 'info');
            console.log('🔄 === INICIANDO CARGA DE MIEMBROS ===');
            
            const members = await this.api.getAllMembers();
            this.allMembers = members;
            this.filteredMembers = [...members]; // Create a copy
            
            console.log(`✅ ${members.length} miembros cargados`);
            
            this.renderMembersList();
            this.updateMembersStats();
            this.renderPagination();
            
            this.showMessage(`✅ ${members.length} miembros cargados exitosamente`, 'success');
            
        } catch (error) {
            console.error('❌ Error cargando miembros:', error);
            this.showMessage(`❌ Error cargando miembros: ${error.message}`, 'error');
        }
    }

    renderMembersList() {
        const container = document.getElementById('members-list');
        if (!container) {
            console.error('❌ Contenedor members-list no encontrado');
            return;
        }
        
        if (this.filteredMembers.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <span style="font-size: 2em;">👥</span><br>
                    ${this.allMembers.length === 0 ? 
                        'Haz clic en "Cargar Miembros" para ver los miembros registrados' : 
                        'No hay miembros que coincidan con los filtros aplicados'
                    }
                </div>
            `;
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.membersPerPage;
        const endIndex = startIndex + this.membersPerPage;
        const pageMembers = this.filteredMembers.slice(startIndex, endIndex);
        
        container.innerHTML = pageMembers.map(member => `
            <div class="member-card">
                <h3>
                    👤 ${member.name}
                    <span class="member-status status-${(member.status || 'unknown').toLowerCase()}">
                        ${member.status === 'ENABLED' ? '🟢 Activo' : member.status === 'DISABLED' ? '🔴 Inactivo' : '❓ Estado desconocido'}
                    </span>
                    <span class="member-type type-${(member.type || 'unknown').toLowerCase()}">
                        ${member.type === 'INTERNAL' ? '👤 Interno' : member.type === 'EXTERNAL' ? '🌐 Externo' : '❓ Tipo desconocido'}
                    </span>
                </h3>
                <div class="member-info">
                    <div><strong>🆔 ID:</strong> ${member.id}</div>
                    <div><strong>📧 Email:</strong> ${member.email || 'No disponible'}</div>
                    <div><strong>👑 Autoridad:</strong> ${member.authority}</div>
                    <div><strong>🎭 Rol ID:</strong> ${member.role_id}</div>
                    <div><strong>📱 Teléfono:</strong> ${member.phone || 'No disponible'}</div>
                    <div><strong>📁 Grupos:</strong> ${
                        member.all_env_group ? 
                        '<span style="color: #3498db; font-weight: bold;">✅ Todos los grupos</span>' :
                        member.env_group_list && member.env_group_list.length > 0 ?
                        `<span style="color: #27ae60;">${member.env_group_list.length} grupos específicos</span>` :
                        '<span style="color: #e74c3c;">❌ Sin grupos</span>'
                    }</div>
                </div>
                ${member.remark ? `
                    <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #3498db;">
                        <strong>💬 Notas:</strong> ${member.remark}
                    </div>
                ` : ''}
                <div class="member-actions">
                    <button class="btn-edit" onclick="app.editMember('${member.id}')">✏️ Editar</button>
                    ${member.authority !== 'SUPER_ADMIN' ? 
                        `<button class="btn-delete" onclick="app.handleDeleteMember('${member.id}', '${member.name}')">🗑️ Eliminar</button>` :
                        '<span style="font-size: 0.85em; color: #888; padding: 8px 12px; display: inline-block; vertical-align: middle;">🛡️ SUPER ADMIN</span>'
                    }
                </div>
            </div>
        `).join('');
    }

    updateMembersStats() {
        if (!this.allMembers.length) {
            const container = document.getElementById('members-stats');
            if (container) container.innerHTML = ''; // Clear stats if no members
            return;
        }
        
        const stats = {
            total: this.allMembers.length,
            filtered: this.filteredMembers.length,
            enabled: this.allMembers.filter(m => m.status === 'ENABLED').length,
            disabled: this.allMembers.filter(m => m.status === 'DISABLED').length,
            internal: this.allMembers.filter(m => m.type === 'INTERNAL').length,
            external: this.allMembers.filter(m => m.type === 'EXTERNAL').length,
            // You can add more stats if needed, e.g., based on groups
        };
        
        const container = document.getElementById('members-stats');
        if (container) {
            container.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db;">
                        <div style="font-size: 1.8em; font-weight: bold; color: #2c3e50;">${stats.filtered}</div>
                        <div style="color: #666; font-size: 0.9em;">Mostrando ${stats.filtered === stats.total && this.allMembers.length > 0 ? 'todos' : `de ${stats.total}`}</div>
                    </div>
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #27ae60;">
                        <div style="font-size: 1.8em; font-weight: bold; color: #27ae60;">${stats.enabled}</div>
                        <div style="color: #666; font-size: 0.9em;">Activos</div>
                    </div>
                    <div style="background: #fdeaea; padding: 15px; border-radius: 8px; border-left: 4px solid #e74c3c;">
                        <div style="font-size: 1.8em; font-weight: bold; color: #e74c3c;">${stats.disabled}</div>
                        <div style="color: #666; font-size: 0.9em;">Inactivos</div>
                    </div>
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
                        <div style="font-size: 1.8em; font-weight: bold; color: #2196f3;">${stats.internal}</div>
                        <div style="color: #666; font-size: 0.9em;">Internos</div>
                    </div>
                    <div style="background: #fff3e0; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800;">
                        <div style="font-size: 1.8em; font-weight: bold; color: #ff9800;">${stats.external}</div>
                        <div style="color: #666; font-size: 0.9em;">Externos</div>
                    </div>
                </div>
            `;
        }
    }

    renderPagination() {
        const container = document.getElementById('pagination');
        if (!container) return;

        if (this.filteredMembers.length <= this.membersPerPage) {
            container.innerHTML = '';
            return;
        }
        
        const totalPages = Math.ceil(this.filteredMembers.length / this.membersPerPage);
        const currentPage = this.currentPage;
        
        let paginationHTML = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
        `;
        
        paginationHTML += `
            <button onclick="app.goToPage(${currentPage - 1})" 
                    ${currentPage === 1 ? 'disabled' : ''} 
                    class="btn-secondary" style="padding: 8px 16px;">← Anterior</button>
        `;
        
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);
        
        if (startPage > 1) {
            paginationHTML += `<button onclick="app.goToPage(1)" class="btn-secondary" style="padding: 8px 12px;">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span style="padding: 8px;">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button onclick="app.goToPage(${i})" 
                        class="${i === currentPage ? 'btn-primary' : 'btn-secondary'}" 
                        style="padding: 8px 12px; min-width: 40px;">${i}</button>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span style="padding: 8px;">...</span>`;
            }
            paginationHTML += `<button onclick="app.goToPage(${totalPages})" class="btn-secondary" style="padding: 8px 12px;">${totalPages}</button>`;
        }
        
        paginationHTML += `
            <button onclick="app.goToPage(${currentPage + 1})" 
                    ${currentPage === totalPages ? 'disabled' : ''} 
                    class="btn-secondary" style="padding: 8px 16px;">Siguiente →</button>
        `;
        
        paginationHTML += `
            <div style="background: #f8f9fa; padding: 8px 12px; border-radius: 6px; margin-left: 10px;">
                Página ${currentPage} de ${totalPages} (${this.filteredMembers.length} miembros)
            </div>
        `;
        
        paginationHTML += `</div>`;
        container.innerHTML = paginationHTML;
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredMembers.length / this.membersPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderMembersList();
            this.renderPagination();
            // Scroll to top of members list for better UX on page change
            document.getElementById('members-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    editMember(memberId) {
        // This method is called from the "Editar" button on member cards
        document.getElementById('edit-member-id').value = memberId;
        // Enable the "Cargar Datos" button as memberId is now set
        const loadDataBtn = document.getElementById('load-member-data');
        if(loadDataBtn) loadDataBtn.disabled = false;
        
        this.loadMemberData(); // This method should already exist in your App class
        document.getElementById('edit-section')?.scrollIntoView({ behavior: 'smooth' });
    }

    handleSearch(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        if (!term) {
            this.filteredMembers = [...this.allMembers];
        } else {
            this.filteredMembers = this.allMembers.filter(member => 
                member.name?.toLowerCase().includes(term) ||
                member.email?.toLowerCase().includes(term) ||
                member.username?.toLowerCase().includes(term) || // Assuming username might exist
                member.id?.toString().includes(term)
            );
        }
        
        this.currentPage = 1;
        this.renderMembersList();
        this.updateMembersStats();
        this.renderPagination();
    }

    handleFilter() {
        const typeFilter = document.getElementById('filter-type')?.value;
        const statusFilter = document.getElementById('filter-status')?.value;
        
        this.filteredMembers = this.allMembers.filter(member => {
            const typeMatch = !typeFilter || member.type === typeFilter;
            const statusMatch = !statusFilter || member.status === statusFilter;
            return typeMatch && statusMatch;
        });
        
        this.currentPage = 1;
        this.renderMembersList();
        this.updateMembersStats();
        this.renderPagination();
                            }

    async loadMemberData() {
        const memberId = document.getElementById('edit-member-id').value.trim();
        const formFields = document.getElementById('form-fields');
        const updateButton = document.getElementById('update-member-btn');

        if (!memberId) {
            this.showMessage('Por favor, ingresa un ID de miembro.', 'error');
            if (formFields) formFields.disabled = true;
            if (updateButton) updateButton.disabled = true;
            return;
        }

        this.showMessage('🔄 Cargando datos del miembro...', 'info');
        if (formFields) formFields.disabled = true;
        if (updateButton) updateButton.disabled = true;
        const btnText = updateButton?.querySelector('.btn-text');
        const btnLoading = updateButton?.querySelector('.btn-loading');
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline';

        try {
            const result = await this.api.getMemberDetails(memberId);
            const member = result.data;

            if (!member) {
                throw new Error(`Miembro con ID ${memberId} no encontrado.`);
            }
            console.log('loadMemberData: Member data fetched (raw):', JSON.stringify(member, null, 2));
            console.log(`loadMemberData: Raw member.all_env_group is: ${member.all_env_group} (type: ${typeof member.all_env_group})`);

            // Robustly determine if the member is effectively in "all groups" mode
            let isEffectivelyInAllGroupsMode = false;
            if (typeof member.all_env_group === 'boolean') {
                isEffectivelyInAllGroupsMode = member.all_env_group;
            } else if (member.all_env_group !== null && member.all_env_group !== undefined) {
                isEffectivelyInAllGroupsMode = String(member.all_env_group).toLowerCase() === 'true';
            }
            console.log(`loadMemberData: isEffectivelyInAllGroupsMode evaluated to: ${isEffectivelyInAllGroupsMode}`);

            document.getElementById('edit-name').value = member.name || '';
            document.getElementById('edit-authority').value = member.authority || '';
            document.getElementById('edit-member-role').value = member.role_id || '';
            document.getElementById('edit-status').value = member.status || ''; 
            document.getElementById('edit-remark').value = member.remark || '';

            const envGroupsContainer = document.getElementById('edit-env-groups-container');
            if (!envGroupsContainer || !envGroupsContainer.hasChildNodes() || !document.getElementById('all-env-groups')) {
                console.log('loadMemberData: Group checkboxes container empty or all-env-groups checkbox missing, calling loadEnvironmentGroups.');
                // Ensure loadEnvironmentGroups populates both edit and create forms if called from here
                await this.loadEnvironmentGroups(); 
                console.log('loadMemberData: loadEnvironmentGroups finished. DOM should now contain group checkboxes for edit form.');
            } else {
                console.log('loadMemberData: Group checkboxes container already populated.');
            }
            
            const allGroupsCheckbox = document.getElementById('all-env-groups');
            if (allGroupsCheckbox) {
                allGroupsCheckbox.checked = isEffectivelyInAllGroupsMode;
                console.log(`loadMemberData: allGroupsCheckbox.checked programmatically set to: ${allGroupsCheckbox.checked} (based on isEffectivelyInAllGroupsMode: ${isEffectivelyInAllGroupsMode})`);
                // Manually trigger change event logic if needed, though direct property setting is usually enough for subsequent JS.
                // However, to ensure the UI (disabled state of specific checkboxes) updates if there's an event listener dependency:
                const changeEvent = new Event('change', { bubbles: true });
                allGroupsCheckbox.dispatchEvent(changeEvent);
                console.log('loadMemberData: Dispatched change event on allGroupsCheckbox after programmatic set.');

                       } else {
                console.warn('loadMemberData: all-env-groups checkbox NOT FOUND even after attempting to load/render groups.');
            }

            const specificGroupCheckboxes = document.querySelectorAll('#edit-env-groups-container input[name="env_group_ids"]');
            console.log(`loadMemberData: Found ${specificGroupCheckboxes.length} specific group checkboxes to process for edit form.`);
            
            specificGroupCheckboxes.forEach(checkbox => {
                // Specific group checkboxes should be disabled if in "all groups" mode.
                checkbox.disabled = isEffectivelyInAllGroupsMode;
                
                let shouldBeChecked = false;
                // Only check specific groups if NOT in "all groups" mode.
                if (!isEffectivelyInAllGroupsMode) {
                    if (member.env_group_list && member.env_group_list.some(g => String(g.group_id || g.id) === checkbox.value)) {
                        shouldBeChecked = true;
                    }
                }
                checkbox.checked = shouldBeChecked;

                console.log(`loadMemberData: Checkbox ID ${checkbox.value}: disabled=${checkbox.disabled}, checked=${checkbox.checked}. (isEffectivelyInAllGroupsMode=${isEffectivelyInAllGroupsMode})`);
            });

            this.showMessage('✅ Datos del miembro cargados.', 'success');
            if (formFields) formFields.disabled = false;
            if (updateButton) updateButton.disabled = false;

        } catch (error) {
            console.error('❌ Error cargando datos del miembro:', error);
            this.showMessage(`❌ Error cargando datos: ${error.message}`, 'error');
            if (formFields) formFields.disabled = true; 
            if (updateButton) updateButton.disabled = true;
        } finally {
            if (btnText) btnText.style.display = 'inline';
            if (btnLoading) btnLoading.style.display = 'none';
        }
    }

    // ADDED: Missing handleEditMember method
    async handleEditMember(event) {
        event.preventDefault();
        const memberId = document.getElementById('edit-member-id').value.trim();
        const form = event.target;
        const updateButton = document.getElementById('update-member-btn');
        const btnText = updateButton?.querySelector('.btn-text');
        const btnLoading = updateButton?.querySelector('.btn-loading');


        if (!memberId) {
            this.showMessage('No se ha especificado un ID de miembro.', 'error');
            return;
        }

        if (!form.checkValidity()) {
            this.showMessage('Por favor, corrige los errores en el formulario.', 'error');
            // HTML5 validation messages will be shown by the browser
            return;
        }
        
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline';
        if (updateButton) updateButton.disabled = true;

        const formData = new FormData(form);
        // Initial memberData from form
        const memberDataFromForm = {
            name: formData.get('name'),
            authority: formData.get('authority'),
            role_id: formData.get('role_id'),
            status: formData.get('status') || undefined, // Send undefined if not set, to keep current
            remark: formData.get('remark'),
            all_env_group: document.getElementById('all-env-groups').checked
        };

        if (!memberDataFromForm.all_env_group) {
            memberDataFromForm.env_group_ids = Array.from(document.querySelectorAll('#edit-env-groups-container input[name="env_group_ids"]:checked')).map(cb => cb.value);
        } else {
            memberDataFromForm.env_group_ids = []; // Explicitly send empty if all_env_group is true
        }
        
        this.showMessage('🔄 Actualizando miembro...', 'info');

        try {
            // Fetch current full details to get email and other potentially required fields
            const currentDetailsResult = await this.api.getMemberDetails(memberId);
            const currentDetails = currentDetailsResult.data;

            if (!currentDetails) {
                throw new Error("No se pudieron obtener los detalles actuales del miembro.");
            }

            // Combine form data with existing data for fields not in the form
            // Ensure all fields required by the API (like email, username, phone) are present
            const completeMemberData = {
                ...currentDetails, // Start with all original data
                ...memberDataFromForm, // Override with form data
            };
            
            // Ensure role_id from form is used if provided and valid
            if (memberDataFromForm.role_id) {
                completeMemberData.role_id = memberDataFromForm.role_id;
            } else if (currentDetails.role_id) { // If form doesn't provide one, use existing
                completeMemberData.role_id = currentDetails.role_id;
            } else {
                // If neither form nor currentDetails has role_id, it might be an issue for updateMemberStrict
                // updateMemberStrict has a fallback to fetch roles, which should cover this.
            }


            await this.api.updateMemberStrict(memberId, completeMemberData);
            this.showMessage('✅ Miembro actualizado exitosamente.', 'success');
            this.resetEditForm();
            document.getElementById('form-fields').disabled = true;
            if (updateButton) updateButton.disabled = true;
            
            // Refresh members list to reflect changes
            await this.loadMembers();

        } catch (error) {
            console.error('❌ Error actualizando miembro:', error);
            this.showMessage(`❌ Error al actualizar: ${error.message}`, 'error');
        } finally {
            if (btnText) btnText.style.display = 'inline';
            if (btnLoading) btnLoading.style.display = 'none';
            // Re-enable button only if form is not reset or still has memberId
            if (document.getElementById('edit-member-id').value.trim()) {
                 if (updateButton) updateButton.disabled = false;
            }
        }
    }

    async handleDeleteMember(memberId, memberName) {
        if (!memberId) {
            this.showMessage('ID de miembro no especificado.', 'error');
            return;
        }

        const confirmationMessage = `¿Estás seguro de que deseas eliminar al miembro "${memberName || 'este miembro'}" (ID: ${memberId})? Esta acción no se puede deshacer.`;
        if (!window.confirm(confirmationMessage)) {
            this.showMessage('🗑️ Eliminación cancelada.', 'info');
            return;
        }

        this.showMessage(`🔄 Eliminando miembro ${memberName || memberId}...`, 'info');

        try {
            await this.api.deleteMember(memberId);
            this.showMessage(`✅ Miembro "${memberName || memberId}" eliminado exitosamente.`, 'success');
            
            // Refresh members list to reflect changes
            // Optimistically remove from local list first for faster UI update
            this.allMembers = this.allMembers.filter(m => m.id !== memberId);
            this.filteredMembers = this.filteredMembers.filter(m => m.id !== memberId);
            
            if (this.filteredMembers.length === 0 && this.currentPage > 1) {
                this.currentPage--; // Go to previous page if current page becomes empty
            }
            
            this.renderMembersList();
            this.updateMembersStats();
            this.renderPagination();

            // Optionally, do a full reload from API if consistency is paramount over speed
            // await this.loadMembers(); 

        } catch (error) {
            console.error(`❌ Error eliminando miembro ${memberId}:`, error);
            this.showMessage(`❌ Error al eliminar: ${error.message}`, 'error');
        }
    }

    async handleCreateMember(event) {
        event.preventDefault();
        const form = event.target;
        const createButton = document.getElementById('create-member-btn');
        const btnText = createButton?.querySelector('.btn-text');
        const btnLoading = createButton?.querySelector('.btn-loading');

        if (!form.checkValidity()) {
            this.showMessage('Por favor, corrige los errores en el formulario de creación.', 'error');
            // HTML5 validation messages will be shown by the browser
            return;
        }

        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline';
        if (createButton) createButton.disabled = true;

        const formData = new FormData(form);
        
        // Explicitly handle optional string fields: trim if they have value, otherwise set to undefined.
        const phoneValue = formData.get('phone');
        const remarkValue = formData.get('remark');
        const managerIdValue = formData.get('manager_id');
        const agentIdValue = formData.get('agent_id');

        const memberData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: phoneValue && phoneValue.trim() !== '' ? phoneValue.trim() : undefined,
            passwd: formData.get('passwd'),
            authority: formData.get('authority'),
            role_id: formData.get('role_id'),
            status: formData.get('status') || 'ENABLED', // Default to ENABLED if not specified
            remark: remarkValue && remarkValue.trim() !== '' ? remarkValue.trim() : undefined,
            type: "INTERNAL", // Explicitly set for this form
            all_env_group: document.getElementById('create-all-env-groups').checked,
            manager_id: managerIdValue && managerIdValue.trim() !== '' ? managerIdValue.trim() : undefined,
            agent_id: agentIdValue && agentIdValue.trim() !== '' ? agentIdValue.trim() : undefined,
        };

        if (!memberData.all_env_group) {
            memberData.env_group_ids = Array.from(document.querySelectorAll('#create-env-groups-container input[name="env_group_ids"]:checked')).map(cb => cb.value);
        } else {
            memberData.env_group_ids = []; // API might expect empty array if all_env_group is true
        }
        
        // Clean up payload: remove keys with undefined values.
        // Required fields should be caught by form validation if empty.
        Object.keys(memberData).forEach(key => {
            if (memberData[key] === undefined) {
                delete memberData[key];
            }
        });
        

        this.showMessage('🔄 Creando miembro...', 'info');

        try {
            const result = await this.api.createMember(memberData);
            
            const createdMemberName = memberData.name; // Use name from form data for reliability
            let successMessage = `✅ Miembro "${createdMemberName}" creado exitosamente.`;

            if (result.data && result.data.id) {
                successMessage += ` ID: ${result.data.id}.`;
            } else {
                console.warn('⚠️ ID del miembro creado no se encontró en la respuesta de la API o result.data es null. Respuesta:', result);
            }
            
            this.showMessage(successMessage, 'success'); // This provides the confirmation notice
            this.resetCreateForm();
            
            // Refresh members list to reflect changes
            await this.loadMembers();

        } catch (error) {
            console.error('❌ Error creando miembro:', error);
            let detailedMessage = error.message;
            if (error.message.includes('already exists')) {
                detailedMessage = 'El email o nombre de usuario ya existe.';
            } else if (error.message.includes('invalid parameter')) {
                detailedMessage = 'Parámetros inválidos. Revisa los datos ingresados.';
            }
            this.showMessage(`❌ Error al crear miembro: ${detailedMessage}`, 'error');
        } finally {
            if (btnText) btnText.style.display = 'inline';
            if (btnLoading) btnLoading.style.display = 'none';
            if (createButton) createButton.disabled = false;
        }
    }

    async testAPIResponses() {
        try {
            this.showMessage('🔍 Iniciando verificación completa de API...', 'info');
            console.log('🔍 === VERIFICACIÓN COMPLETA DE API ===');
            
            const testResults = [];
            const apiKey = document.getElementById('api-key').value;
            
            if (!apiKey) {
                this.showMessage('Por favor ingresa tu API Key primero', 'error');
                return;
            }
            
            const testEndpoints = [
                { name: 'Conexión básica', endpoint: '/v1/env/list', method: 'GET' },
                { name: 'Lista de miembros', endpoint: '/v1/members?page=1&size=1', method: 'GET' },
                { name: 'Roles de miembros', endpoint: '/v1/member/roles', method: 'GET' },
                { name: 'Grupos de perfil', endpoint: '/v1/env/group', method: 'GET' },
                { name: 'Team ID automático', endpoint: 'AUTO_TEAM_ID', method: 'SPECIAL' }
            ];
            
            for (const test of testEndpoints) {
                try {
                    console.log(`🧪 Probando: ${test.name}`);
                    let result;
                    let responseTime = Date.now();
                    
                    if (test.endpoint === 'AUTO_TEAM_ID') {
                        result = await this.api.getTeamId();
                        responseTime = Date.now() - responseTime;
                        testResults.push({
                            name: test.name,
                            status: result ? 'PASS' : 'WARN',
                            message: result ? `Team ID detectado: ${result}` : 'No se pudo detectar team_id',
                            time: responseTime
                        });
                    } else {
                        result = await this.api.makeRequest(test.endpoint, test.method);
                        responseTime = Date.now() - responseTime;
                        testResults.push({
                            name: test.name,
                            status: 'PASS',
                            message: `Respuesta exitosa (${responseTime}ms)`,
                            time: responseTime
                        });
                    }
                    
                } catch (error) {
                    testResults.push({
                        name: test.name,
                        status: 'FAIL',
                        message: error.message,
                        time: 0
                    });
                }
            }
            
            this.displayTestResults(testResults);
            
            const passCount = testResults.filter(r => r.status === 'PASS').length;
            const totalCount = testResults.length;
            
            if (passCount === totalCount) {
                this.showMessage(`✅ Verificación completada: ${passCount}/${totalCount} pruebas exitosas`, 'success');
            } else {
                this.showMessage(`⚠️ Verificación completada: ${passCount}/${totalCount} pruebas exitosas`, 'info');
            }
            
        } catch (error) {
            console.error('❌ Error en verificación de API:', error);
            this.showMessage(`❌ Error en verificación: ${error.message}`, 'error');
        }
    }

    displayTestResults(results) {
        console.log('📊 === RESULTADOS DE PRUEBAS ===');
        results.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
            console.log(`${icon} ${result.name}: ${result.message}`);
        });
        // Optionally, render these results to the HTML
    }

    // MOVED/VERIFIED: testMemberUpdate (if used)
    async testMemberUpdate() { // This button was removed from HTML, if re-added, this method will be used.
        try {
            this.showMessage('🧪 Iniciando prueba de actualización de miembro...', 'info');
            console.log('🧪 === PRUEBA DE ACTUALIZACIÓN DE MIEMBRO ===');
            
            if (this.allMembers.length === 0) {
                this.showMessage('⚠️ Primero debes cargar la lista de miembros', 'error');
                return;
            }
            
            const randomMember = this.allMembers[Math.floor(Math.random() * this.allMembers.length)];
            console.log(`🎯 Miembro seleccionado para prueba: ${randomMember.name} (ID: ${randomMember.id})`);
            
            const currentDataResult = await this.api.getMemberDetails(randomMember.id);
            const member = currentDataResult.data;
            console.log('📋 Datos actuales del miembro:', member);
            
            const testData = {
                name: member.name,
                authority: member.authority,
                role_id: member.role_id,
                type: member.type,
                status: member.status,
                all_env_group: member.all_env_group,
                remark: `[PRUEBA ${new Date().toISOString()}] ${member.remark || 'Prueba de actualización'}`
            };
            
            console.log('📤 Datos de prueba a enviar:', testData);
            await this.api.updateMemberStrict(randomMember.id, testData);
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            const verifyDataResult = await this.api.getMemberDetails(randomMember.id);
            
            const success = verifyDataResult.data.remark && verifyDataResult.data.remark.includes('[PRUEBA');
            
            if (success) {
                console.log('✅ Prueba de actualización EXITOSA');
                this.showMessage(`✅ Prueba exitosa: Miembro ${member.name} actualizado correctamente`, 'success');
                
                const restoreData = { ...member, remark: member.remark || '' }; // Use original member data for restore
                await this.api.updateMemberStrict(randomMember.id, restoreData);
                console.log('🔄 Datos originales restaurados');
            } else {
                console.log('❌ Prueba de actualización FALLÓ');
                this.showMessage('❌ La prueba no se completó correctamente', 'error');
            }
        } catch (error) {
            console.error('❌ Error en prueba de actualización:', error);
            this.showMessage(`❌ Error en prueba: ${error.message}`, 'error');
        }
    }

    // MOVED/VERIFIED: loadTestUser
    async loadTestUser() {
        try {
            const testUserId = document.getElementById('test-user-id').value.trim();
            
            if (!testUserId) {
                this.showMessage('Por favor ingresa un ID de usuario para probar', 'error');
                return;
            }
            
            this.showMessage('🔄 Cargando usuario de prueba...', 'info');
            console.log(`🔍 === CARGANDO USUARIO DE PRUEBA: ${testUserId} ===`);
            
            const result = await this.api.getMemberDetails(testUserId);
            const member = result.data;
            
            if (!member) {
                throw new Error(`Usuario con ID ${testUserId} no encontrado`);
            }
            
            const testUserInfo = document.getElementById('test-user-info');
            const testUserDetails = document.getElementById('test-user-details');
            
            if (testUserInfo && testUserDetails) {
                testUserInfo.style.display = 'block';
                let groupsInfo = '';
                if (member.all_env_group) {
                    groupsInfo = '<span style="color: #3498db; font-weight: bold;">✅ Acceso a TODOS los grupos</span>';
                } else if (member.env_group_list && member.env_group_list.length > 0) {
                    const groupsList = member.env_group_list.map(g => 
                        `<span style="background: #27ae60; color: white; padding: 2px 6px; border-radius: 8px; font-size: 0.8em; margin: 2px;">${g.env_group_name || g.name || g.id}</span>`
                    ).join(' ');
                    groupsInfo = `<div><strong>🎯 Grupos específicos (${member.env_group_list.length}):</strong><br>${groupsList}</div>`;
                } else {
                    groupsInfo = '<span style="color: #e74c3c; font-weight: bold;">❌ Sin grupos asignados</span>';
                }
                
                testUserDetails.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div><strong>🆔 ID:</strong> ${member.id}</div>
                        <div><strong>👤 Nombre:</strong> ${member.name}</div>
                        <div><strong>📧 Email:</strong> ${member.email || 'No disponible'}</div>
                        <div><strong>📱 Teléfono:</strong> ${member.phone || 'No disponible'}</div>
                        <div><strong>👑 Autoridad:</strong> ${member.authority}</div>
                        <div><strong>🎭 Rol ID:</strong> ${member.role_id}</div>
                        <div><strong>📊 Estado:</strong> <span style="color: ${member.status === 'ENABLED' ? '#27ae60' : '#e74c3c'};">${member.status === 'ENABLED' ? '🟢 Activo' : '🔴 Inactivo'}</span></div>
                        <div><strong>🏷️ Tipo:</strong> <span style="color: ${member.type === 'INTERNAL' ? '#3498db' : '#f39c12'};">${member.type === 'INTERNAL' ? '👤 Interno' : '🌐 Externo'}</span></div>
                    </div>
                    <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #3498db;">
                        <strong>📁 Acceso a Grupos:</strong><br>${groupsInfo}
                    </div>
                    ${member.remark ? `<div style="margin: 15px 0; padding: 15px; background: #e8f4fd; border-radius: 8px; border-left: 4px solid #3498db;"><strong>💬 Notas:</strong><br>${member.remark}</div>` : ''}
                `;
            }
            
            document.getElementById('edit-member-id').value = testUserId;
            await this.loadMemberData(); // This will now work
            
            this.showMessage(`✅ Usuario de prueba ${member.name} cargado exitosamente`, 'success');
            
        } catch (error) {
            console.error('❌ Error cargando usuario de prueba:', error);
            this.showMessage(`❌ Error: ${error.message}`, 'error');
        }
    }

    // MOVED/VERIFIED: executeDetailedEditTest and its helper
    async executeDetailedEditTest() {
        try {
            const testUserId = document.getElementById('test-user-id').value.trim();
            if (!testUserId) {
                this.showMessage('Por favor carga un usuario de prueba primero', 'error');
                return;
            }
            
            this.showMessage('🚀 Iniciando prueba detallada de edición...', 'info');
            console.log(`🚀 === PRUEBA DETALLADA DE EDICIÓN: ${testUserId} ===`);
            
            const testResultsContainer = document.getElementById('detailed-test-results');
            if (testResultsContainer) testResultsContainer.style.display = 'block';
            
            const steps = [];
            
            steps.push({ name: 'Cargando datos originales', status: 'running' });
            this.updateTestSteps(steps);
            const originalDataResult = await this.api.getMemberDetails(testUserId);
            const original = originalDataResult.data;
            steps[0] = { name: 'Cargando datos originales', status: 'success', message: `Usuario ${original.name} cargado` };
            this.updateTestSteps(steps);
            
            steps.push({ name: 'Preparando datos de prueba', status: 'running' });
            this.updateTestSteps(steps);
            const testTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const testData = {
                ...original, // Start with all original data
                remark: `[PRUEBA-${testTimestamp}] Prueba detallada de edición - ${original.remark || 'Sin notas previas'}`
            };
            steps[1] = { name: 'Preparando datos de prueba', status: 'success', message: 'Datos preparados' };
            this.updateTestSteps(steps);
            
            steps.push({ name: 'Ejecutando actualización', status: 'running' });
            this.updateTestSteps(steps);
            await this.api.updateMemberStrict(testUserId, testData);
            steps[2] = { name: 'Ejecutando actualización', status: 'success', message: 'Actualización enviada' };
            this.updateTestSteps(steps);
            
            steps.push({ name: 'Verificando cambios', status: 'running' });
            this.updateTestSteps(steps);
            await new Promise(resolve => setTimeout(resolve, 1500));
            const verifyDataResult = await this.api.getMemberDetails(testUserId);
            const updated = verifyDataResult.data;
            const changesDetected = updated.remark && updated.remark.includes(`[PRUEBA-${testTimestamp}]`);
            steps[3] = { name: 'Verificando cambios', status: changesDetected ? 'success' : 'warning', message: changesDetected ? 'Cambios verificados' : 'No se detectaron cambios' };
            this.updateTestSteps(steps);
            
            steps.push({ name: 'Restaurando datos originales', status: 'running' });
            this.updateTestSteps(steps);
            const restoreData = { ...original, remark: original.remark || '' }; // Ensure all original fields are restored
            await this.api.updateMemberStrict(testUserId, restoreData);
            steps[4] = { name: 'Restaurando datos originales', status: 'success', message: 'Datos restaurados' };
            this.updateTestSteps(steps);
            
            steps.push({ name: 'Verificación final', status: 'running' });
            this.updateTestSteps(steps);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const finalDataResult = await this.api.getMemberDetails(testUserId);
            const restored = finalDataResult.data;
            const restoredCorrectly = (original.remark || '') === (restored.remark || ''); // Compare remarks
            steps[5] = { name: 'Verificación final', status: restoredCorrectly ? 'success' : 'warning', message: restoredCorrectly ? 'Prueba completada' : 'Restauración puede no ser completa' };
            this.updateTestSteps(steps);
            
            this.showMessage(restoredCorrectly ? `✅ Prueba detallada completada` : `⚠️ Prueba completada con advertencias`, restoredCorrectly ? 'success' : 'info');
            console.log('✅ Prueba detallada completada');
            
        } catch (error) {
            console.error('❌ Error en prueba detallada:', error);
            this.showMessage(`❌ Error en prueba detallada: ${error.message}`, 'error');
            const testStepsContainer = document.getElementById('test-steps');
            if (testStepsContainer && testStepsContainer.lastElementChild) {
                const lastStep = testStepsContainer.lastElementChild;
                lastStep.innerHTML = lastStep.innerHTML.replace('🔄', '❌').replace('status: running', 'status: failed');
            }
        }
    }

    updateTestSteps(steps) {
        const testStepsContainer = document.getElementById('test-steps');
        if (!testStepsContainer) return;
        
        testStepsContainer.innerHTML = steps.map((step, index) => {
            const icon = step.status === 'success' ? '✅' : 
                        step.status === 'running' ? '🔄' : 
                        step.status === 'warning' ? '⚠️' : '❌';
            return `
                <div style="padding: 10px; margin: 5px 0; border-radius: 6px; background: ${
                    step.status === 'success' ? '#d4edda' : 
                    step.status === 'running' ? '#e2e3e5' : 
                    step.status === 'warning' ? '#fff3cd' : '#f8d7da'
                };">
                    <div style="font-weight: bold; margin-bottom: 5px;">
                        ${icon} Paso ${index + 1}: ${step.name}
                    </div>
                    ${step.message ? `<div style="font-size: 0.9em; color: #666;">${step.message}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    // MOVED/VERIFIED: runAdvancedDiagnostic and its helper
    async runAdvancedDiagnostic() {
        try {
            this.showMessage('🔍 Ejecutando diagnóstico avanzado...', 'info');
            console.log('🔍 === DIAGNÓSTICO AVANZADO DEL SISTEMA ===');
            const diagnosticResults = [];
            
            try {
                const connectivityTest = await this.api.testConnection();
                diagnosticResults.push({ category: 'Conectividad', test: 'Conexión básica a DICloak', status: connectivityTest ? 'PASS' : 'FAIL', message: connectivityTest ? 'Conexión establecida' : 'No se pudo conectar' });
            } catch (error) {
                diagnosticResults.push({ category: 'Conectividad', test: 'Conexión básica a DICloak', status: 'FAIL', message: error.message });
            }
            
            try {
                const teamId = await this.api.getTeamId();
                diagnosticResults.push({ category: 'Configuración', test: 'Detección Team ID', status: teamId ? 'PASS' : 'WARN', message: teamId ? `Team ID: ${teamId}` : 'No se detectó team_id' });
            } catch (error) {
                diagnosticResults.push({ category: 'Configuración', test: 'Detección Team ID', status: 'FAIL', message: error.message });
            }
            
            try {
                const membersTest = await this.api.makeRequest('/v1/members?page=1&size=1', 'GET');
                diagnosticResults.push({ category: 'API', test: 'Acceso API miembros', status: 'PASS', message: `${membersTest.data?.total || 0} miembros disponibles` });
            } catch (error) {
                diagnosticResults.push({ category: 'API', test: 'Acceso API miembros', status: 'FAIL', message: error.message });
            }
            
            try {
                const groupsTest = await this.api.getEnvironmentGroups();
                diagnosticResults.push({ category: 'API', test: 'Acceso API grupos', status: (groupsTest.data?.list?.length || 0) > 0 ? 'PASS' : 'WARN', message: `${groupsTest.data?.list?.length || 0} grupos disponibles` });
            } catch (error) {
                diagnosticResults.push({ category: 'API', test: 'Acceso API grupos', status: 'WARN', message: `API grupos: ${error.message}` });
            }
            
            try {
                const rolesTest = await this.api.getMemberRoles();
                diagnosticResults.push({ category: 'API', test: 'Acceso API roles', status: (rolesTest.data?.list?.length || 0) > 0 ? 'PASS' : 'WARN', message: `${rolesTest.data?.list?.length || 0} roles disponibles` });
            } catch (error) {
                diagnosticResults.push({ category: 'API', test: 'Acceso API roles', status: 'WARN', message: `API roles: ${error.message}` });
            }
            
            this.displayDiagnosticResults(diagnosticResults);
            const passCount = diagnosticResults.filter(r => r.status === 'PASS').length;
            this.showMessage(`📊 Diagnóstico: ${passCount}/${diagnosticResults.length} OK`, 'info');
        } catch (error) {
            console.error('❌ Error en diagnóstico avanzado:', error);
            this.showMessage(`❌ Error en diagnóstico: ${error.message}`, 'error');
        }
    }

    displayDiagnosticResults(results) {
        console.log('📊 === RESULTADOS DE DIAGNÓSTICO ===');
        results.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
            console.log(`${icon} [${result.category}] ${result.test}: ${result.message}`);
        });
        // Optionally, render these results to the HTML
    }

    // MOVED/VERIFIED: testGroupRepair and its helper
    async testGroupRepair() {
        try {
            this.showMessage('🔧 Iniciando reparación de grupos...', 'info');
            console.log('🔧 === REPARACIÓN DE GRUPOS ===');
            
            const isConnected = await this.api.testConnection();
            if (!isConnected) throw new Error('No hay conexión con DICloak');
            
            const repairResults = [];
            
            try {
                const groupsResult = await this.api.getEnvironmentGroups();
                repairResults.push({ step: 'Verificación API grupos', status: 'SUCCESS', message: `${groupsResult.data?.list?.length || 0} grupos encontrados` });
                if ((groupsResult.data?.list?.length || 0) === 0) {
                    repairResults.push({ step: 'Búsqueda endpoints alternativos', status: 'RUNNING', message: 'Buscando...' });
                    const altEndpoint = await this.api.findWorkingGroupsEndpoint();
                    repairResults[repairResults.length - 1] = { step: 'Búsqueda endpoints alternativos', status: altEndpoint ? 'SUCCESS' : 'WARNING', message: altEndpoint ? `Alternativo: ${altEndpoint.endpoint}` : 'No encontrado' };
                }
            } catch (error) {
                repairResults.push({ step: 'Verificación API grupos', status: 'ERROR', message: error.message });
            }
            
            try {
                const teamId = await this.api.getTeamId();
                repairResults.push({ step: 'Verificación Team ID', status: teamId ? 'SUCCESS' : 'WARNING', message: teamId ? `Team ID: ${teamId}` : 'No detectado' });
            } catch (error) {
                repairResults.push({ step: 'Verificación Team ID', status: 'ERROR', message: error.message });
            }
            
            try {
                await this.loadEnvironmentGroups();
                repairResults.push({ step: 'Recarga grupos interfaz', status: 'SUCCESS', message: 'Grupos recargados' });
            } catch (error) {
                repairResults.push({ step: 'Recarga grupos interfaz', status: 'ERROR', message: error.message });
            }
            
            this.displayRepairResults(repairResults);
            const successCount = repairResults.filter(r => r.status === 'SUCCESS').length;
            this.showMessage(`🔧 Reparación: ${successCount}/${repairResults.length} OK`, 'info');
        } catch (error) {
            console.error('❌ Error en reparación de grupos:', error);
            this.showMessage(`❌ Error en reparación: ${error.message}`, 'error');
        }
    }

    displayRepairResults(results) {
        console.log('🔧 === RESULTADOS DE REPARACIÓN ===');
        results.forEach(result => {
            const icon = result.status === 'SUCCESS' ? '✅' : result.status === 'ERROR' ? '❌' : '⚠️';
            console.log(`${icon} ${result.step}: ${result.message}`);
        });
        // Optionally, render these results to the HTML
    }

}

// IMPROVED: Better initialization with error boundary
function initializeApp() {
    try {
        console.log('🚀 Inicializando aplicación DICloak...');
        
        // Check for required DOM elements
        const requiredElements = ['api-key', 'message', 'members-list', 'edit-member-form'];
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            throw new Error(`Elementos DOM faltantes: ${missingElements.join(', ')}`);
        }
        
        app = new App();
        console.log('✅ Aplicación inicializada correctamente');
        
        // Enable API key toggle functionality
        const toggleBtn = document.getElementById('toggle-api-key');
        const apiKeyInput = document.getElementById('api-key');
        
        if (toggleBtn && apiKeyInput) {
            toggleBtn.addEventListener('click', () => {
                const isPassword = apiKeyInput.type === 'password';
                apiKeyInput.type = isPassword ? 'text' : 'password';
                toggleBtn.textContent = isPassword ? '🙈' : '👁️';
            });
        }
        
    } catch (error) {
        console.error('❌ Error inicializando aplicación:', error);
        
        const messageElement = document.getElementById('message');
        if (messageElement) {
            messageElement.textContent = `❌ Error de inicialización: ${error.message}`;
            messageElement.className = 'message error';
            messageElement.style.display = 'block';
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

window.debugDICloak = function() {
    console.log('=== DEBUG INFO ===');
    console.log('App instance:', app);
    console.log('API instance:', app?.api);
    console.log('Members loaded:', app?.allMembers?.length || 0);
    console.log('Current page:', app?.currentPage || 'N/A');
    console.log('API Key set:', !!app?.api?.apiKey);
    console.log('Team ID:', app?.api?.teamId || 'Not detected');
    console.log('==================');
};