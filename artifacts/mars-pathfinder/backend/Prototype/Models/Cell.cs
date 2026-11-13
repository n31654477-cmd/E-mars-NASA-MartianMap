namespace Backend.Models
{
    public class Cell
    {
        public int Id { get; set; }
        public int Row { get; set; }
        public int Col { get; set; }

        public double CenterLat { get; set; }
        public double CenterLng { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }

        public double SafetyScore { get; set; }
        public double RadiationLevel { get; set; }
        public int MountainCount { get; set; }
        public string WeatherCondition { get; set; } = "Clear";

        public bool Blocked { get; set; }

        // Persisted so the calculated value is included in API responses.
        public double DF { get; set; }

        public void ComputeDF()
        {
            DF =
                (RadiationLevel / 10.0) * 2.0 +
                MountainCount * 1.5 +
                GetWeatherDangerFactor();
        }

        private double GetWeatherDangerFactor()
        {
            switch (WeatherCondition)
            {
                case "DustStorm":
                    return 10.0;

                case "ColdSnap":
                    return 5.0;

                default:
                    return 0.0;
            }
        }
    }
}
