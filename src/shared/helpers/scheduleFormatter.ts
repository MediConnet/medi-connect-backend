/**
 * Formatea horarios de atención de forma inteligente.
 * Lógica:
 * 1. Si los horarios son homogéneos (mismo inicio/fin todos los días), muestra "Lun-Vie HH:mm - HH:mm".
 * 2. Si son heterogéneos, muestra el horario de HOY para priorizar la inmediatez.
 */
export function formatSmartSchedule(schedules: any[]): string {
  if (!schedules || schedules.length === 0) {
    return 'Horario no disponible';
  }

  // Filtrar solo días activos
  const activeSchedules = schedules.filter(s => s.is_active);
  if (activeSchedules.length === 0) return 'Temporalmente no disponible';

  const formatTime = (dateStr: Date | string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const firstStart = formatTime(activeSchedules[0].start_time);
  const firstEnd = formatTime(activeSchedules[0].end_time);
  
  const isHomogeneous = activeSchedules.every(s => 
    formatTime(s.start_time) === firstStart && 
    formatTime(s.end_time) === firstEnd
  );

  const daysMap = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  if (isHomogeneous) {
    activeSchedules.sort((a, b) => a.day_of_week - b.day_of_week);
    
    const startDay = daysMap[activeSchedules[0].day_of_week];
    const endDay = daysMap[activeSchedules[activeSchedules.length - 1].day_of_week];
    
    if (activeSchedules.length === 1) {
      return `${startDay} ${firstStart}-${firstEnd}`;
    }
    
    return `${startDay}-${endDay} ${firstStart}-${firstEnd}`;
  }

  const now = new Date();
  now.setHours(now.getHours() - 5); 
  const todayIndex = now.getDay(); 

  const todaySchedule = activeSchedules.find(s => s.day_of_week === todayIndex);

  if (todaySchedule) {
    return `Hoy: ${formatTime(todaySchedule.start_time)} - ${formatTime(todaySchedule.end_time)}`;
  } else {
    return 'Hoy: Cerrado';
  }
}