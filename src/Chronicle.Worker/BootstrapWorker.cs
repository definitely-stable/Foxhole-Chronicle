namespace Chronicle.Worker;

public sealed partial class BootstrapWorker(
    ILogger<BootstrapWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        LogBootstrapRunning(logger);

        try
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
            LogBootstrapStopping(logger);
        }
    }

    [LoggerMessage(
        EventId = 1000,
        Level = LogLevel.Information,
        Message = "Chronicle Worker bootstrap is running. Ingestion is intentionally disabled until the first ingestion vertical slice.")]
    private static partial void LogBootstrapRunning(ILogger logger);

    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Information,
        Message = "Chronicle Worker bootstrap is stopping.")]
    private static partial void LogBootstrapStopping(ILogger logger);
}
