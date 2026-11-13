using Backend.Models;

namespace Backend.Business
{
    public static class GridGenerator
    {
        private static readonly Random Random = new Random();

        private static readonly string[] WeatherConditions =
        {
            "Clear",
            "DustStorm",
            "ColdSnap"
        };

        public static Cell[][] GenerateGrid(GenerateGridRequest request)
        {
            int rows = request.Rows;
            int columns = request.Columns;

            double latitudeStep =
                (request.EndLat - request.StartLat) / rows;

            double longitudeStep =
                (request.EndLng - request.StartLng) / columns;

            Cell[][] cells = new Cell[rows][];

            int nextId = 0;

            for (int row = 0; row < rows; row++)
            {
                cells[row] = new Cell[columns];

                for (int col = 0; col < columns; col++)
                {
                    Cell cell = new Cell
                    {
                        Id = nextId++,
                        Row = row,
                        Col = col,

                        CenterLat =
                            request.StartLat + (row + 0.5) * latitudeStep,

                        CenterLng =
                            request.StartLng + (col + 0.5) * longitudeStep,

                        Width = longitudeStep,
                        Height = latitudeStep,

                        SafetyScore = Random.NextDouble() * 100.0,
                        RadiationLevel = Random.NextDouble() * 100.0,
                        MountainCount = Random.Next(0, 6),

                        WeatherCondition = GetRandomWeatherCondition(),
                        Blocked = false
                    };

                    cell.ComputeDF();

                    cells[row][col] = cell;
                }
            }

            return cells;
        }

        private static string GetRandomWeatherCondition()
        {
            return WeatherConditions[
                Random.Next(WeatherConditions.Length)];
        }
    }
}