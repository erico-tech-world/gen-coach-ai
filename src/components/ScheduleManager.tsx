import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ScheduleManagerProps {
  courseId: string;
  currentSchedule?: string;
  onScheduleUpdate: (schedule: string) => void;
}

export function ScheduleManager({ courseId, currentSchedule, onScheduleUpdate }: ScheduleManagerProps) {
  const [scheduleType, setScheduleType] = useState(currentSchedule?.includes('daily') ? 'daily' : 'weekly');
  const [studyTime, setStudyTime] = useState('19:00');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const { toast } = useToast();

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast({
          title: "Notifications Enabled",
          description: "You'll receive reminders for your study sessions.",
        });
      }
    }
  };

  const handleScheduleUpdate = () => {
    const schedule = `${scheduleType} at ${studyTime}`;
    onScheduleUpdate(schedule);
    
    if (reminderEnabled) {
      requestNotificationPermission();
    }
    
    toast({
      title: "Schedule Updated",
      description: `Your study schedule has been set to ${schedule}.`,
    });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Study Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select value={scheduleType} onValueChange={setScheduleType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="weekends">Weekends Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Study Time</Label>
          <div className="relative">
            <Clock className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              type="time"
              value={studyTime}
              onChange={(e) => setStudyTime(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <Label>Enable Reminders</Label>
          </div>
          <Button
            variant={reminderEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setReminderEnabled(!reminderEnabled)}
          >
            {reminderEnabled ? "On" : "Off"}
          </Button>
        </div>

        <Button onClick={handleScheduleUpdate} className="w-full">
          Update Schedule
        </Button>
      </CardContent>
    </Card>
  );
}