import { context, trace } from '@opentelemetry/api';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { SessionProvider, SimpleSessionManager } from '@opentelemetry/sdk-trace-base';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { B3Propagator } from '@opentelemetry/propagator-b3';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource, ResourceProvider } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'fetch-example',
});

const resourceProvider = new ResourceProvider(resource); 

const traceProvider = new WebTracerProvider({
  resourceProvider: resourceProvider 
});

const sessionManager = new SimpleSessionManager('default', resourceProvider);
sessionManager.createSession();

// Note: For production consider using the "BatchSpanProcessor" to reduce the number of requests
// to your exporter. Using the SimpleSpanProcessor here as it sends the spans immediately to the
// exporter without delay
traceProvider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
// traceProvider.addSpanProcessor(new SimpleSpanProcessor(new OTLPTraceExporter()));
traceProvider.register({
  contextManager: new ZoneContextManager(),
  propagator: new B3Propagator()
});

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      ignoreUrls: [/localhost:8090\/sockjs-node/],
      propagateTraceHeaderCorsUrls: [
        'https://cors-test.appspot.com/test',
        'https://httpbin.org/get',
      ],
      clearTimingResources: true,
    }),
  ],
});

// const sessionProvider = new SessionProvider(resourceProvider);
// sessionProvider.addSessionManager("default", new SimpleSessionManager());

const webTracerWithZone = traceProvider.getTracer('example-tracer-web');

const getData = (url) => fetch(url, {
  method: 'GET',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// example of keeping track of context between async operations
const prepareClickEvent = () => {
  const url = 'https://httpbin.org/get';

  const element = document.getElementById('button1');

  const onClick = () => {
    const singleSpan = webTracerWithZone.startSpan('files-series-info');
    context.with(trace.setSpan(context.active(), singleSpan), () => {
      getData(url).then((_data) => {
        trace.getSpan(context.active()).addEvent('fetching-single-span-completed');
        singleSpan.end();
      });
    });
    for (let i = 0, j = 5; i < j; i += 1) {
      const span = webTracerWithZone.startSpan(`files-series-info-${i}`);
      context.with(trace.setSpan(context.active(), span), () => {
        getData(url).then((_data) => {
          trace.getSpan(context.active()).addEvent(`fetching-span-${i}-completed`);
          span.end();
        });
      });
    }
  };
  element.addEventListener('click', onClick);
};

window.addEventListener('load', prepareClickEvent);
